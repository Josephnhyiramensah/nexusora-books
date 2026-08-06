'use strict';

/**
 * applyColumnMapping (hardened)
 * -----------------------------
 * Turns a COMPACT grid (from genericTabularReader: header at row 0, spacer
 * columns already dropped) + a user/auto column mapping into normalized bank
 * lines, then validates.
 *
 * Adds over v1:
 *   - Row STITCHING: continuation rows (counterparty/narration on their own
 *     line, no amount) fold into the transaction above instead of being dropped.
 *   - Non-transaction FILTERING: Balance at Period Start/End, BALANCE FORWARD,
 *     TOTAL, page footers, reward-points trailers are excluded; period Start/End
 *     balances are harvested as gate endpoints; statement body stops at an END
 *     marker so appended tables never pollute the import.
 *   - CONDITIONAL balance gate: runs only when a Balance column is mapped.
 *     Without one, import still succeeds on count/sum sanity (QBO behaviour).
 *   - Date-format aware parsing (DMY default for Ghana; MDY / YMD selectable).
 *   - In-cell newline cleanup (PDF wrap artifacts).
 *
 * mapping = {
 *   bankName, headerRow?, dataStartRow?,
 *   amountConvention: 'separate' | 'signed',
 *   dateFormat: 'DMY' | 'MDY' | 'YMD' (optional; DMY default),
 *   columns: { date, valueDate, description, debit, credit, amount, balance,
 *              reference, counterparty }  // each = compact column index
 * }
 *
 * Returns:
 *   { ok:false, error, balanceChecked? }              // shown as the dry-run X
 *   { ok:true, meta, lines, totals }                  // importable
 *   meta.balanceChecked / balanceChainOk / declaredOpening / declaredClosing
 */

const crypto = require('crypto');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isBlankCell = (v) => v === null || v === undefined || String(v).trim() === '';
const isNumericCell = (v) =>
  typeof v === 'number' ||
  (typeof v === 'string' && v.trim() !== '' && /^-?[\d,]+\.?\d*$/.test(v.trim().replace(/,/g, '')));
const cleanText = (v) =>
  (v == null ? '' : String(v).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim());
const squish = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function numAt(row, idx) {
  if (idx < 0) return null;
  const c = row[idx];
  if (c === null || c === undefined) return null;
  if (typeof c === 'number') return isFinite(c) ? c : null;
  const s = String(c).trim();
  if (s === '' || !/^-?[\d,]+\.?\d*$/.test(s.replace(/,/g, ''))) return null;
  const n = Number(s.replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11 };
const safeDate = (y, mo, d) => { const dt = new Date(Date.UTC(y, mo, d)); return isNaN(dt) ? null : dt; };

function parseDate(v, fmt) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[\r\n]+/g, ' ').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[ \-\/]+([A-Za-z]{3,})[ \-\/]+(\d{2,4})$/);
  if (m) {
    const d = +m[1]; const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    let y = +m[3]; if (y < 100) y += 2000;
    if (mo != null) return safeDate(y, mo, d);
  }
  const parts = s.split(/[\/\-.]/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const a = +parts[0], b = +parts[1], c = +parts[2];
    let d, mo, y;
    const order = String(fmt || '').toUpperCase();
    if (order.startsWith('Y')) { y = a; mo = b - 1; d = c; }
    else if (order === 'MDY') { mo = a - 1; d = b; y = c; }
    else if (order === 'DMY') { d = a; mo = b - 1; y = c; }
    else if (a > 31) { y = a; mo = b - 1; d = c; }      // auto: YMD
    else { d = a; mo = b - 1; y = c; }                  // auto: DMY (Ghana default)
    if (y < 100) y += 2000;
    return safeDate(y, mo, d);
  }
  const g = new Date(s);
  return isNaN(g) ? null : g;
}

const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function resolveCol(role, headerRow) {
  if (role === null || role === undefined || role === '') return -1;
  if (/^\d+$/.test(String(role))) return parseInt(role, 10);
  const want = String(role).trim().toUpperCase();
  return headerRow.findIndex((h) => h != null && String(h).trim().toUpperCase() === want);
}

function externalIdFor(fileHash, seq, amount, date) {
  return crypto.createHash('sha256')
    .update([fileHash || '', seq, r2(Math.abs(amount)), isoDay(date)].join('|'))
    .digest('hex').slice(0, 24);
}

// --- non-transaction markers ------------------------------------------------
// full  = squished join of all non-numeric cells (survives PDF word-wrap)
// desc  = squished mapped Description cell (tightens TOTAL / CLOSING BALANCE)
function isSkipMarker(full, desc) {
  const s = squish(full);
  if (s.includes('balanceatperiodstart')) return true;
  if (s.includes('balanceforward') || s.includes('balancebroughtforward') || s.includes('balancecarriedforward')) return true;
  if (/page\d+of\d+/.test(s)) return true;
  if (squish(desc) === 'openingbalance') return true;
  return false;
}
function isEndMarker(full, desc) {
  const s = squish(full);
  if (s.includes('balanceatperiodend')) return true;
  if (s.includes('rewardpoints') || s.includes('pointsaccrued') || s.includes('pointsredeemed')) return true;
  const d = squish(desc);
  if (d === 'closingbalance') return true;
  if (/^(grand)?totals?$/.test(d)) return true;
  if (/^total(debits?|credits?|deposits?|withdrawals?)$/.test(d)) return true;
  return false;
}

function rowLabelText(row) {
  return row.filter((c) => !isNumericCell(c)).map(cleanText).filter(Boolean).join(' ');
}

function applyColumnMapping(grid, mapping, opts = {}) {
  const { fileHash = '' } = opts;
  const headerRowIndex = (mapping.headerRow != null) ? mapping.headerRow : 0;
  const dataStart = (mapping.dataStartRow != null) ? mapping.dataStartRow : headerRowIndex + 1;
  const headerRow = grid[headerRowIndex] || [];
  const cols = mapping.columns || {};

  const iDate = resolveCol(cols.date, headerRow);
  const iVal  = resolveCol(cols.valueDate, headerRow);
  const iDesc = resolveCol(cols.description, headerRow);
  const iDeb  = resolveCol(cols.debit, headerRow);
  const iCred = resolveCol(cols.credit, headerRow);
  const iAmt  = resolveCol(cols.amount, headerRow);
  const iBal  = resolveCol(cols.balance, headerRow);
  const iRef  = resolveCol(cols.reference, headerRow);
  const iCp   = resolveCol(cols.counterparty, headerRow);

  const signedConvention = mapping.amountConvention === 'signed';
  const dateFmt = mapping.dateFormat || null;
  const hasBalanceCol = iBal >= 0;

  if (iDate < 0) return { ok: false, error: 'Mapping incomplete: no Date column.' };
  if (signedConvention && iAmt < 0) return { ok: false, error: 'Mapping incomplete: no Amount column for the signed-amount convention.' };
  if (!signedConvention && iDeb < 0 && iCred < 0) return { ok: false, error: 'Mapping incomplete: map a Debit and/or Credit column (or switch to a single signed Amount column).' };

  const lines = [];
  let seq = 0, current = null;
  let declaredOpening = null, declaredClosing = null, reachedEnd = false;

  for (let i = dataStart; i < grid.length && !reachedEnd; i++) {
    const row = grid[i] || [];
    if (!row.some((c) => !isBlankCell(c))) continue;

    const full = rowLabelText(row);
    const descCell = iDesc >= 0 ? cleanText(row[iDesc]) : '';

    if (isEndMarker(full, descCell)) {
      const b = numAt(row, iBal); if (b != null) declaredClosing = r2(b);
      reachedEnd = true; break;
    }
    if (isSkipMarker(full, descCell)) {
      const b = numAt(row, iBal); if (b != null && declaredOpening == null) declaredOpening = r2(b);
      continue;
    }

    let debit = 0, credit = 0;
    if (signedConvention) {
      const a = numAt(row, iAmt);
      if (a != null) { if (a < 0) debit = Math.abs(a); else credit = a; }
    } else {
      const d = numAt(row, iDeb); const c = numAt(row, iCred);
      if (d != null) debit = d;
      if (c != null) credit = c;
    }
    const signed = r2(credit - debit);
    const balNum = numAt(row, iBal);
    const dateVal = parseDate(row[iDate], dateFmt);
    const desc = iDesc >= 0 ? cleanText(row[iDesc]) : '';
    const cp   = iCp  >= 0 ? cleanText(row[iCp])  : '';
    const ref  = iRef >= 0 ? cleanText(row[iRef]) : '';

    if (signed !== 0) {
      // real money movement -> new transaction anchor
      seq += 1;
      current = {
        seq, date: dateVal,
        valueDate: iVal >= 0 ? parseDate(row[iVal], dateFmt) : null,
        description: desc,
        direction: signed > 0 ? 'in' : 'out',
        amount: r2(Math.abs(signed)),
        debit: r2(debit), credit: r2(credit), signed,
        balance: balNum != null ? r2(balNum) : null,
        fee: 0, eLevy: 0,
        balanceAfter: balNum != null ? r2(balNum) : null,
        counterparty: cp, counterpartyNo: '',
        reference: ref,
        externalId: externalIdFor(fileHash, seq, signed, dateVal),
        matchStatus: 'unmatched', bucket: null, suggestedContra: null,
      };
      lines.push(current);
    } else if (current && !dateVal && balNum == null && (desc || cp || ref)) {
      // continuation row (no amount, no date, no balance) -> fold upward
      const extra = [desc, cp, ref].filter(Boolean).join(' ');
      if (extra) current.description = cleanText(current.description + ' ' + extra);
      if (!current.counterparty && cp) current.counterparty = cp;
    }
    // zero-amount rows with a balance but no marker are ignored (no money moved)
  }

  if (!lines.length) {
    return { ok: false, error: 'No transactions found after mapping. The Debit/Credit (or signed Amount) column is likely mapped to the wrong column.' };
  }

  let sumIn = 0, sumOut = 0;
  for (const l of lines) { if (l.direction === 'in') sumIn = r2(sumIn + l.amount); else sumOut = r2(sumOut + l.amount); }

  let balanceChecked = false, balanceChainOk = null, opening = null, closing = null;
  if (hasBalanceCol) {
    const firstBal = lines.find((l) => l.balance != null);
    const lastBal = [...lines].reverse().find((l) => l.balance != null);
    if (firstBal && lastBal) {
      balanceChecked = true;
      opening = declaredOpening != null ? declaredOpening : r2(firstBal.balance - firstBal.signed);
      let prev = opening, breaks = 0, firstBreak = null;
      for (const l of lines) {
        const expected = r2(prev + l.signed);
        if (l.balance != null) {
          if (Math.abs(expected - l.balance) > 0.02) { breaks++; if (!firstBreak) firstBreak = { seq: l.seq, expected, got: l.balance }; }
          prev = l.balance;
        } else { prev = expected; }
      }
      closing = lastBal.balance;
      if (breaks !== 0) {
        return {
          ok: false, balanceChecked: true, breaks,
          error: 'This mapping does not balance (' + breaks + ' of ' + lines.length + ' rows fail the running-balance check). The Debit/Credit or Balance column is likely mapped wrong. First mismatch at row ' + firstBreak.seq + ': expected ' + firstBreak.expected.toFixed(2) + ', got ' + firstBreak.got.toFixed(2) + '.',
        };
      }
      if (declaredClosing != null && Math.abs(closing - declaredClosing) > 0.02) {
        return {
          ok: false, balanceChecked: true,
          error: 'The running balance is internally consistent but does not reach the statement\'s closing balance (statement says ' + declaredClosing.toFixed(2) + ', computed ' + closing.toFixed(2) + '). A transaction row may be missing or a marker row was misread.',
        };
      }
      balanceChainOk = true;
    }
  }

  const meta = {
    source: 'bank', format: 'mapped', mappedBank: mapping.bankName || null,
    openingBalance: opening, closingBalance: closing,
    periodStart: isoDay(lines[0].date), periodEnd: isoDay(lines[lines.length - 1].date),
    fileHash, balanceChecked, balanceChainOk,
    declaredOpening, declaredClosing,
  };
  const totals = { totalIn: sumIn, totalOut: sumOut, totalFees: 0, count: lines.length };
  return { ok: true, meta, lines, totals };
}

module.exports = { applyColumnMapping };
