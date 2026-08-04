'use strict';

/**
 * fidelityXlsxAdapter
 * -------------------
 * Parses a Fidelity Bank Ghana "Statement of Account" Excel export into a
 * normalized, validated structure. Posts NOTHING to the ledger — this is a
 * pure parse + integrity-check step. Everything downstream (matching,
 * confirm-to-post, reconciliation) consumes this output.
 *
 * Format assumptions (verified against real KGR / medical-centre exports):
 *   - Single sheet, one physical row per transaction.
 *   - Header row contains: DATE, DESCRIPTION, VALUE DATE, DEBIT, CREDIT, BALANCE
 *     (there is a phantom empty column between DESCRIPTION and VALUE DATE — we
 *     locate columns by header label, not by fixed index, so this is harmless).
 *   - DEBIT / CREDIT are numbers, or the string "--" when blank. A row never
 *     has both populated.
 *   - BALANCE is the running balance AFTER the row (our integrity anchor).
 *   - A trailing "Turnover : <dr> <cr>" footer row (BALANCE cell non-numeric).
 *
 * Sign convention: signed = credit - debit. This is the debit-to-1020 amount:
 *   signed > 0  => money IN  (Dr Bank 1020)
 *   signed < 0  => money OUT (Cr Bank 1020)
 *
 * Usage:
 *   const { parseFidelityXlsx } = require('./fidelityXlsxAdapter');
 *   const result = parseFidelityXlsx('/path/to/statement.xlsx');
 *   // or parseFidelityXlsx(buffer)  // e.g. multer file.buffer
 */

const XLSX = require('xlsx');
const crypto = require('crypto');

const FORMAT = 'fidelity-xlsx';
const BLANK = '--';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Coerce a DEBIT/CREDIT cell ("--", number, "1,234.56", null) to a number. */
function toAmount(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === '' || s === BLANK) return 0;
  const n = Number(s.replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}

/** Is a cell a usable numeric balance? (footer/blank rows are not) */
function isNumericCell(v) {
  if (typeof v === 'number') return isFinite(v);
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (s === '' || s === BLANK) return false;
  return isFinite(Number(s.replace(/,/g, '')));
}

/** Normalize a date cell to a JS Date (SheetJS gives Date when cellDates:true). */
function toDate(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'number') {
    // Excel serial fallback (if cellDates was off)
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim());
    if (!isNaN(d)) return d;
  }
  return null;
}

const isoDate = (d) => (d ? d.toISOString().slice(0, 10) : null);

/* ------------------------------------------------------------------ */
/* description field extraction                                        */
/* ------------------------------------------------------------------ */

/**
 * Pull structured fields out of the free-text DESCRIPTION.
 * Best-effort: only populates what actually matches. Semantic bucketing
 * (bucket -> contra account) is deliberately NOT done here — that is Step 2.
 */
function extractFields(desc) {
  const text = (desc || '').replace(/\s+/g, ' ').trim();
  const out = {
    branch: null,
    type: null,
    counterparty: null,
    chqNo: null,
    phone: null,
    sessionId: null,
    ref: null,
  };
  if (!text) return out;

  // "SANTASI ROUNDABOUT BRANCH: <rest>"  |  "HEAD OFFICE: <rest>"
  const firstColon = text.indexOf(':');
  let rest = text;
  if (firstColon > -1) {
    out.branch = text.slice(0, firstColon).trim() || null;
    rest = text.slice(firstColon + 1).trim();
  }

  // type = token up to first ';'
  const semi = rest.indexOf(';');
  out.type = (semi > -1 ? rest.slice(0, semi) : rest).trim() || null;

  const chq = text.match(/(?:CHQ#?|CHEQUE\s*#)\s*:?\s*(\d{3,})/i);
  if (chq) out.chqNo = chq[1];

  const phone = text.match(/\b(233\d{9})\b/);
  if (phone) out.phone = phone[1];

  const sess = text.match(/SESSION ID[:\s-]*([0-9]{6,})/i);
  if (sess) out.sessionId = sess[1];

  const ref = text.match(/(?:Src\s+)?Ref[:.]?\s*([A-Za-z0-9]{4,})/);
  if (ref) out.ref = ref[1];

  // counterparty: IFO <name> / B/O <name> / "<phone>-<label>"
  let cp = text.match(/\bIFO\s+([A-Za-z0-9 .,'&\-]+?)(?:\s+CHQ#|\s+CHQ|\s*$)/i)
        || text.match(/\bB\/O\s+([A-Za-z0-9 .,'&\-]+?)(?:\s+CHQ#|\s+YEBOF|\s*$)/i);
  if (cp) {
    out.counterparty = cp[1].trim();
  } else if (out.phone) {
    const label = text.match(/233\d{9}-([^;]+)$/);
    if (label) out.counterparty = label[1].trim();
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* main parse                                                          */
/* ------------------------------------------------------------------ */

function parseFidelityXlsx(input, opts = {}) {
  const { filename = null } = opts;

  let buf;
  if (Buffer.isBuffer(input)) {
    buf = input;
  } else if (typeof input === 'string') {
    buf = require('fs').readFileSync(input);
  } else {
    throw new Error('parseFidelityXlsx: input must be a file path or a Buffer');
  }

  const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('parseFidelityXlsx: workbook has no sheets');

  const grid = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  // Locate header row by label (robust to the phantom column / re-ordering)
  let headerIdx = -1;
  let col = {};
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i].map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : c));
    const find = (label) => row.findIndex((c) => c === label);
    const iDate = find('DATE');
    const iBal = find('BALANCE');
    if (iDate > -1 && iBal > -1) {
      headerIdx = i;
      col = {
        date: iDate,
        description: find('DESCRIPTION'),
        valueDate: find('VALUE DATE'),
        debit: find('DEBIT'),
        credit: find('CREDIT'),
        balance: iBal,
      };
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('parseFidelityXlsx: could not locate a header row (DATE..BALANCE)');
  }

  const lines = [];
  const footerRows = [];
  let seq = 0;

  for (let i = headerIdx + 1; i < grid.length; i++) {
    const raw = grid[i];
    const balCell = raw[col.balance];

    // Footer / non-transaction row -> not a ledger line, keep for checksum
    if (!isNumericCell(balCell)) {
      const joined = raw.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').join(' ');
      if (joined) footerRows.push(joined);
      continue;
    }

    seq += 1;
    const debit = round2(toAmount(raw[col.debit]));
    const credit = round2(toAmount(raw[col.credit]));
    const balance = round2(toAmount(balCell));
    const signed = round2(credit - debit);
    const description = raw[col.description] != null ? String(raw[col.description]).trim() : '';

    lines.push({
      seq,
      postingDate: toDate(raw[col.date]),
      valueDate: col.valueDate > -1 ? toDate(raw[col.valueDate]) : null,
      description,
      debit,
      credit,
      signed,
      balance,
      extracted: extractFields(description),
      // downstream fields (populated in later steps)
      matchStatus: 'unmatched',
      validation: { balanceOk: true, note: null },
    });
  }

  /* ---- validation: balance chain ---------------------------------- */
  const issues = [];
  let openingBalance = null;
  let closingBalance = null;
  let sumDebit = 0;
  let sumCredit = 0;

  if (lines.length) {
    openingBalance = round2(lines[0].balance - lines[0].signed);
    let prev = openingBalance;
    for (const ln of lines) {
      sumDebit = round2(sumDebit + ln.debit);
      sumCredit = round2(sumCredit + ln.credit);
      const expected = round2(prev + ln.signed);
      if (Math.abs(expected - ln.balance) > 0.005) {
        ln.validation.balanceOk = false;
        ln.validation.note = `balance break: expected ${expected.toFixed(2)}, got ${ln.balance.toFixed(2)}`;
        issues.push({ seq: ln.seq, message: ln.validation.note });
      }
      prev = ln.balance;
    }
    closingBalance = lines[lines.length - 1].balance;
  }

  /* ---- validation: turnover footer checksum ----------------------- */
  let turnover = null;
  const footerText = footerRows.join(' ');
  const tm = footerText.match(/Turnover[^0-9-]*([\d,]+\.\d{2})\D+([\d,]+\.\d{2})/i);
  if (tm) {
    turnover = { debit: round2(Number(tm[1].replace(/,/g, ''))), credit: round2(Number(tm[2].replace(/,/g, ''))) };
  }
  const turnoverOk = turnover
    ? Math.abs(turnover.debit - sumDebit) <= 0.01 && Math.abs(turnover.credit - sumCredit) <= 0.01
    : null; // null = no footer to check against

  const balanceChainOk = issues.length === 0;

  const periodStart = lines.length
    ? lines.reduce((min, l) => (l.postingDate && (!min || l.postingDate < min) ? l.postingDate : min), null)
    : null;
  const periodEnd = lines.length
    ? lines.reduce((max, l) => (l.postingDate && (!max || l.postingDate > max) ? l.postingDate : max), null)
    : null;

  return {
    meta: {
      format: FORMAT,
      filename,
      fileHash,
      sheetName: wb.SheetNames[0],
      currency: 'GHS',
      rowCount: lines.length,
      openingBalance,
      closingBalance,
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
    },
    totals: { debit: sumDebit, credit: sumCredit, count: lines.length },
    validation: {
      balanceChainOk,
      turnoverOk,
      turnover,
      issues, // [] when clean
      ok: balanceChainOk && turnoverOk !== false,
    },
    lines,
  };
}

/* ------------------------------------------------------------------ */
/* parse-result -> persistable documents (pure; no DB writes)         */
/* ------------------------------------------------------------------ */

/**
 * Shape a parse result into { importDoc, lineDocs } ready to hand to
 * Mongoose (BankStatementImport.create + BankStatementLine.insertMany).
 * Deliberately does NOT touch the database — the controller wires that up
 * in a later step. lineDocs reference the import via `statementImport`,
 * which the caller sets after creating the import doc.
 */
function toImportDocuments(result, ctx = {}) {
  const { bankAccountCode = '1020', bankAccountNumber = null, accountHolder = null, createdBy = null } = ctx;

  const importDoc = {
    bankAccountCode,
    bankAccountNumber,
    accountHolder,
    currency: result.meta.currency,
    source: {
      filename: result.meta.filename,
      fileHash: result.meta.fileHash,
      format: result.meta.format,
      sheetName: result.meta.sheetName,
    },
    period: { start: result.meta.periodStart, end: result.meta.periodEnd },
    openingBalance: result.meta.openingBalance,
    closingBalance: result.meta.closingBalance,
    totals: result.totals,
    validation: {
      balanceChainOk: result.validation.balanceChainOk,
      turnoverOk: result.validation.turnoverOk,
      turnover: result.validation.turnover,
      issues: result.validation.issues,
      ok: result.validation.ok,
    },
    status: 'parsed',
    createdBy,
  };

  const lineDocs = result.lines.map((l) => ({
    seq: l.seq,
    postingDate: l.postingDate,
    valueDate: l.valueDate,
    description: l.description,
    debit: l.debit,
    credit: l.credit,
    signed: l.signed,
    balance: l.balance,
    extracted: l.extracted,
    validation: l.validation,
    matchStatus: l.matchStatus,
  }));

  return { importDoc, lineDocs };
}

module.exports = {
  parseFidelityXlsx,
  toImportDocuments,
  FORMAT,
  _internals: { extractFields, toAmount, toDate },
};
