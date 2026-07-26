// server/utils/momoParser.js
// Parses an MTN Mobile Money statement (.xls / .xlsx / .csv) into normalized
// statement lines. One reader (SheetJS) handles all three formats, including the
// old OLE .xls that MTN's export produces.
//
// Direction is DERIVED, not read: a row is 'out' when the statement's own MSISDN
// is the FROM number, 'in' when it's the TO number. Getting this wrong flips
// every debit/credit, so it is computed per row against the account's MSISDN.
const XLSX = require('xlsx');

const HEADER_KEYS = {
  date: 'TRANSACTION DATE',
  fromAcct: 'FROM ACCT',
  fromName: 'FROM NAME',
  fromNo: 'FROM NO.',
  type: 'TRANS. TYPE',
  amount: 'AMOUNT',
  fees: 'FEES',
  eLevy: 'E-LEVY',
  balBefore: 'BAL BEFORE',
  balAfter: 'BAL AFTER',
  toNo: 'TO NO.',
  toName: 'TO NAME',
  toAcct: 'TO ACCT',
  fId: 'F_ID',
  ref: 'REF',
  ova: 'OVA',
};

const num = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const clean = (v) => (v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim());

// MoMo dates look like "23-Jul-2026 08:56:24 PM"
const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // fallback: DD-Mon-YYYY hh:mm:ss AM/PM
  const m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i);
  if (m) {
    const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    let hh = parseInt(m[4], 10);
    if (m[7] && /pm/i.test(m[7]) && hh < 12) hh += 12;
    if (m[7] && /am/i.test(m[7]) && hh === 12) hh = 0;
    return new Date(parseInt(m[3]), months[m[2].toLowerCase()], parseInt(m[1]), hh, parseInt(m[5]), parseInt(m[6]));
  }
  return null;
};

/**
 * @param {Buffer} buffer  the uploaded file
 * @returns {{ meta, lines, totals }}
 */
function parseMomoStatement(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // rows as arrays, blanks preserved so column indices stay stable
  // raw:true returns true numeric cell values. With raw:false SheetJS returns
  // FORMATTED display strings, which round 1.51 to 2 and 1391.87 to 1392 -- that
  // silently corrupts every figure and breaks reconciliation. Verified against a
  // real statement: raw:true ties all lines to the penny, raw:false does not.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

  // --- locate header row + account MSISDN -----------------------------------
  let headerRow = -1;
  let msisdn = '';
  let holder = '';
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map(clean).join(' ').toUpperCase();
    if (msisdn === '') {
      const mm = joined.match(/\b(233\d{9})\b/);
      if (mm && joined.includes('MSISDN')) msisdn = mm[1];
    }
    if (holder === '' && joined.includes('ACCOUNT HOLDER NAME')) {
      // holder name is the last non-empty cell on that row
      const cells = rows[i].map(clean).filter(Boolean);
      holder = cells[cells.length - 1] || '';
    }
    if (rows[i].map(clean).some((c) => c.toUpperCase() === HEADER_KEYS.date)) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) throw new Error('Could not find the transaction header row (TRANSACTION DATE).');
  if (!msisdn) {
    // fallback: some exports put MSISDN without the label nearby
    for (const r of rows) {
      const m = r.map(clean).join(' ').match(/\b(233\d{9})\b/);
      if (m) { msisdn = m[1]; break; }
    }
  }

  // map column name -> index from the header row
  const hdr = rows[headerRow].map(clean);
  const col = {};
  for (const [key, label] of Object.entries(HEADER_KEYS)) {
    col[key] = hdr.findIndex((c) => c.toUpperCase() === label);
  }

  // --- parse data rows ------------------------------------------------------
  const lines = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const dateRaw = col.date >= 0 ? clean(r[col.date]) : '';
    if (!dateRaw) continue;                 // skip blanks / footer
    if (!/\d/.test(dateRaw)) continue;      // skip stray text rows

    const fromNo = clean(r[col.fromNo]);
    const toNo = clean(r[col.toNo]);
    const direction = msisdn && fromNo.includes(msisdn) ? 'out'
                    : msisdn && toNo.includes(msisdn) ? 'in'
                    : num(r[col.balAfter]) <= num(r[col.balBefore]) ? 'out' : 'in';

    const counterparty = direction === 'out' ? clean(r[col.toName]) : clean(r[col.fromName]);
    const counterpartyNo = direction === 'out' ? toNo : fromNo;

    lines.push({
      date: parseDate(r[col.date]),
      description: clean(r[col.ref]) || clean(r[col.type]),
      type: clean(r[col.type]),
      direction,
      amount: num(r[col.amount]),
      fee: num(r[col.fees]),
      eLevy: num(r[col.eLevy]),
      balanceAfter: num(r[col.balAfter]),
      counterparty,
      counterpartyNo,
      externalId: clean(r[col.fId]),
      reference: clean(r[col.ref]),
      matchStatus: 'unmatched',
    });
  }

  if (lines.length === 0) throw new Error('No transactions found in the statement.');

  const totals = {
    totalIn: lines.filter((l) => l.direction === 'in').reduce((s, l) => s + l.amount, 0),
    totalOut: lines.filter((l) => l.direction === 'out').reduce((s, l) => s + l.amount, 0),
    totalFees: lines.reduce((s, l) => s + l.fee + l.eLevy, 0),
  };

  // statement is newest-first; opening = oldest line's balBefore-equivalent.
  const withBal = lines.filter((l) => Number.isFinite(l.balanceAfter));
  const closingBalance = withBal.length ? withBal[0].balanceAfter : null;      // newest row
  const openingBalance = withBal.length ? (withBal[withBal.length - 1].balanceAfter
      - (withBal[withBal.length - 1].direction === 'in'
          ? withBal[withBal.length - 1].amount
          : -(withBal[withBal.length - 1].amount + withBal[withBal.length - 1].fee + withBal[withBal.length - 1].eLevy))) : null;

  return {
    meta: { source: 'momo', accountHolder: holder, accountMsisdn: msisdn,
            periodStart: lines.length ? lines[lines.length - 1].date : null,
            periodEnd: lines.length ? lines[0].date : null,
            openingBalance, closingBalance },
    lines,
    totals,
  };
}


// ---- PDF branch --------------------------------------------------------------
// MTN's PDF puts each transaction on ONE line starting with a date; the
// counterparty NAME wraps onto the lines above/below, but every load-bearing
// field (amounts, balances, TO NO., F_ID) lives on the date-line itself. So we
// parse the date-lines and ignore the wrapped names. Verified against a real
// 38-transaction statement: all lines reconcile to the penny.
const TXN_TYPES = new Set(['TRANSFER','DEBIT','PAYMENT','CASH_OUT','CASH_IN','CREDIT','REVERSAL']);
const DATE_LINE = /^(\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+(.*)$/;

async function parseMomoPdf(buffer) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const rows = result.text.split('\n');

  const isDate = (l) => /^\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M/.test(l.trim());
  const TYPES = new Set(['TRANSFER','DEBIT','PAYMENT','CASH_OUT','CASH_IN','CREDIT','REVERSAL']);
  const num = (x) => parseFloat(String(x).replace(/[^0-9.\-]/g, '')) || 0;

  let msisdn = '', holder = '';
  for (const l of rows) {
    if (!msisdn) { const m = l.match(/MSISDN:\s*(233\d{9})/); if (m) msisdn = m[1]; }
    if (!holder) { const m = l.match(/ACCOUNT HOLDER NAME:\s*(.+?)\s*$/); if (m) holder = m[1].trim(); }
  }
  if (!msisdn) { const m = result.text.match(/(233\d{9})/); if (m) msisdn = m[1]; }

  // MTN's PDF wraps long counterparty names onto continuation lines, which pushes
  // the F_ID off the date-line. So group each date-line with the lines that
  // follow it (until the next date-line), then parse the combined block. The
  // date-line columns are tab-separated; joining continuations with tabs keeps
  // the token boundaries clean. Verified against a real 38-txn statement: every
  // line reconciles and every F_ID is recovered.
  const groups = [];
  for (let i = 0; i < rows.length; i++) {
    if (!isDate(rows[i])) continue;
    let block = rows[i];
    for (let j = i + 1; j < rows.length && !isDate(rows[j]); j++) block += '\t' + rows[j];
    groups.push(block);
  }

  const lines = [];
  for (const g of groups) {
    const cols = g.split('\t').map((c) => c.trim()).filter(Boolean);
    const ti = cols.findIndex((c) => TYPES.has(c));
    if (ti === -1) continue;
    const amount = num(cols[ti + 1]);
    const fee = num(cols[ti + 2]);
    const eLevy = num(cols[ti + 3]);
    const balBefore = num(cols[ti + 4]);
    const balAfter = num(cols[ti + 5]);
    const fromNo = cols[ti - 1] || '';
    const toNo = cols[ti + 6] || '';
    // F_ID: an 11-digit number after toNo, not a 233-prefixed phone number.
    const externalId = cols.slice(ti + 6).find((c) => /^\d{11}$/.test(c) && !c.startsWith('233')) || '';
    const dateStr = cols[0];
    const type = cols[ti];
    const direction = fromNo.includes(msisdn) ? 'out' : toNo.includes(msisdn) ? 'in'
      : (balAfter <= balBefore ? 'out' : 'in');
    lines.push({
      date: parseDate(dateStr), description: type, type, direction,
      amount, fee, eLevy, balanceAfter: balAfter,
      counterparty: '', counterpartyNo: direction === 'out' ? toNo : fromNo,
      externalId, reference: '', matchStatus: 'unmatched',
    });
  }
  if (lines.length === 0) throw new Error('No transactions found in the PDF statement.');

  const totals = {
    totalIn: lines.filter((l) => l.direction === 'in').reduce((s, l) => s + l.amount, 0),
    totalOut: lines.filter((l) => l.direction === 'out').reduce((s, l) => s + l.amount, 0),
    totalFees: lines.reduce((s, l) => s + l.fee + l.eLevy, 0),
  };
  const withBal = lines.filter((l) => Number.isFinite(l.balanceAfter));
  const closingBalance = withBal.length ? withBal[0].balanceAfter : null;
  const last = withBal[withBal.length - 1];
  const openingBalance = last ? (last.direction === 'in'
    ? last.balanceAfter - last.amount
    : last.balanceAfter + last.amount + last.fee + last.eLevy) : null;

  return {
    meta: { source: 'momo', accountHolder: holder, accountMsisdn: msisdn,
      periodStart: lines.length ? lines[lines.length - 1].date : null,
      periodEnd: lines.length ? lines[0].date : null,
      openingBalance, closingBalance },
    lines, totals,
  };
}

// Dispatcher: choose the parser by file type. PDFs are detected by the %PDF
// magic bytes (or a .pdf name); everything else goes through SheetJS.
async function parseStatement(buffer, fileName) {
  const isPdf = (fileName && /\.pdf$/i.test(fileName))
    || (buffer && buffer.length > 4 && buffer.slice(0, 4).toString('latin1') === '%PDF');
  return isPdf ? parseMomoPdf(buffer) : parseMomoStatement(buffer);
}
module.exports = { parseMomoStatement, parseMomoPdf, parseStatement };
