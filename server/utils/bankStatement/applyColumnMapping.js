'use strict';
const crypto = require('crypto');
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function toAmount(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === '' || s === '--' || s === '-') return 0;
  const n = Number(s.replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}
function toDate(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'string' && v.trim()) { const d = new Date(v.trim()); if (!isNaN(d)) return d; }
  return null;
}
const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
function resolveCol(role, headerRow) {
  if (role === null || role === undefined || role === '') return -1;
  if (/^\d+$/.test(String(role))) return parseInt(role, 10);
  const want = String(role).trim().toUpperCase();
  return headerRow.findIndex((h) => h !== null && h !== undefined && String(h).trim().toUpperCase() === want);
}
function externalIdFor(fileHash, seq, amount, date) {
  return crypto.createHash('sha256').update([fileHash || '', seq, r2(Math.abs(amount)), isoDay(date)].join('|')).digest('hex').slice(0, 24);
}
function applyColumnMapping(grid, mapping, opts = {}) {
  const { fileHash = '' } = opts;
  const headerRowIndex = (mapping.headerRow != null) ? mapping.headerRow : 0;
  const dataStart = (mapping.dataStartRow != null) ? mapping.dataStartRow : headerRowIndex + 1;
  const headerRow = grid[headerRowIndex] || [];
  const cols = mapping.columns || {};
  const iDate = resolveCol(cols.date, headerRow);
  const iVal = resolveCol(cols.valueDate, headerRow);
  const iDesc = resolveCol(cols.description, headerRow);
  const iDeb = resolveCol(cols.debit, headerRow);
  const iCred = resolveCol(cols.credit, headerRow);
  const iAmt = resolveCol(cols.amount, headerRow);
  const iBal = resolveCol(cols.balance, headerRow);
  const iRef = resolveCol(cols.reference, headerRow);
  const iCp = resolveCol(cols.counterparty, headerRow);
  const signedConvention = mapping.amountConvention === 'signed';
  if (iDate < 0) return { ok: false, error: 'Mapping incomplete: no Date column.' };
  if (iBal < 0) return { ok: false, error: 'Mapping incomplete: no Balance column (needed to verify the import).' };
  if (signedConvention && iAmt < 0) return { ok: false, error: 'Mapping incomplete: no Amount column for signed convention.' };
  if (!signedConvention && iDeb < 0 && iCred < 0) return { ok: false, error: 'Mapping incomplete: need Debit and/or Credit columns.' };
  const lines = [];
  let seq = 0;
  for (let i = dataStart; i < grid.length; i++) {
    const row = grid[i] || [];
    const balCell = row[iBal];
    const balIsNum = (typeof balCell === 'number') || (typeof balCell === 'string' && balCell.trim() !== '' && /^-?[\d,]+\.?\d*$/.test(balCell.trim().replace(/,/g, '')));
    if (!balIsNum) continue;
    seq += 1;
    let debit = 0, credit = 0;
    if (signedConvention) {
      const amt = toAmount(row[iAmt]);
      if (amt < 0) debit = Math.abs(amt); else credit = amt;
    } else {
      debit = toAmount(row[iDeb]);
      credit = toAmount(row[iCred]);
    }
    const signed = r2(credit - debit);
    const balance = r2(toAmount(balCell));
    const date = toDate(row[iDate]);
    const description = iDesc >= 0 && row[iDesc] != null ? String(row[iDesc]).trim() : '';
    lines.push({
      seq, date,
      valueDate: iVal >= 0 ? toDate(row[iVal]) : null,
      description,
      direction: signed > 0 ? 'in' : 'out',
      amount: r2(Math.abs(signed)),
      debit: r2(debit), credit: r2(credit), signed, balance,
      fee: 0, eLevy: 0,
      balanceAfter: balance,
      counterparty: iCp >= 0 && row[iCp] != null ? String(row[iCp]).trim() : '',
      counterpartyNo: '',
      reference: iRef >= 0 && row[iRef] != null ? String(row[iRef]).trim() : '',
      externalId: externalIdFor(fileHash, seq, signed, date),
      matchStatus: 'unmatched',
      bucket: null, suggestedContra: null,
    });
  }
  if (!lines.length) return { ok: false, error: 'No data rows found with the mapped Balance column.' };
  const opening = r2(lines[0].balance - lines[0].signed);
  let prev = opening, breaks = 0, firstBreak = null;
  let sumIn = 0, sumOut = 0;
  for (const l of lines) {
    if (l.direction === 'in') sumIn = r2(sumIn + l.amount); else sumOut = r2(sumOut + l.amount);
    const expected = r2(prev + l.signed);
    if (Math.abs(expected - l.balance) > 0.02) {
      breaks++;
      if (!firstBreak) firstBreak = { seq: l.seq, expected, got: l.balance };
    }
    prev = l.balance;
  }
  const closing = lines[lines.length - 1].balance;
  if (breaks !== 0) {
    return {
      ok: false,
      error: 'This mapping does not balance (' + breaks + ' of ' + lines.length + ' rows fail the running-balance check). The Debit/Credit or Balance columns are likely mapped wrong. First mismatch at row ' + firstBreak.seq + ': expected ' + firstBreak.expected.toFixed(2) + ', got ' + firstBreak.got.toFixed(2) + '.',
      breaks,
    };
  }
  const meta = {
    source: 'bank', format: 'mapped', mappedBank: mapping.bankName || null,
    openingBalance: opening, closingBalance: closing,
    periodStart: isoDay(lines[0].date), periodEnd: isoDay(lines[lines.length - 1].date),
    fileHash, balanceChainOk: true,
  };
  const totals = { totalIn: sumIn, totalOut: sumOut, totalFees: 0 };
  return { ok: true, meta, lines, totals };
}
module.exports = { applyColumnMapping };
