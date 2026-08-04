'use strict';

/**
 * Bank statement dispatcher
 * -------------------------
 * The single entry point the reconciliation controller calls for ANY bank
 * statement. The controller stays bank-neutral: it says "parse this bank
 * statement", and the registry resolves which bank FORMAT it is and routes to
 * the matching adapter. Every adapter returns the SAME { meta, lines, totals }
 * contract (identical to utils/momoParser.js), so downstream code never knows
 * or cares which bank produced the file.
 *
 * Adding a new bank = add one entry to ADAPTERS. No controller change.
 *
 * No DB, no ledger.
 */

const { fidelityToSessionLines } = require('./fidelityToSessionLines');

/**
 * Each adapter:
 *   key       : stable format id (stored on the session as meta.format)
 *   label     : human name for UI / logs
 *   detect(buf, fileName) -> boolean : cheap signature test
 *   parse(input, opts) -> { meta, lines, totals }
 *
 * Order matters only for auto-detection: first match wins.
 */
const ADAPTERS = [
  {
    key: 'fidelity',
    label: 'Fidelity Bank Ghana',
    detect: detectFidelity,
    parse: (input, opts) => {
      const out = fidelityToSessionLines(input, opts);
      out.meta.format = 'fidelity';
      return out;
    },
  },
  // Future: { key:'gcb', label:'GCB Bank', detect:detectGcb, parse:gcbToSessionLines }, etc.
];

/**
 * Fidelity signature: an xlsx whose sheet carries the
 * DATE / DESCRIPTION / VALUE DATE / DEBIT / CREDIT / BALANCE header row.
 * We read only the first sheet's header region — cheap, no full parse.
 */
function detectFidelity(buffer) {
  try {
    // eslint-disable-next-line global-require
    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer', sheetRows: 12 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return false;
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    return grid.some((row) => {
      const up = row.map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : c));
      return up.includes('DATE') && up.includes('BALANCE') &&
        (up.includes('DEBIT') || up.includes('CREDIT')) && up.includes('VALUE DATE');
    });
  } catch (e) {
    return false;
  }
}

function listFormats() {
  return ADAPTERS.map((a) => ({ key: a.key, label: a.label }));
}

function getAdapter(format) {
  return ADAPTERS.find((a) => a.key === format) || null;
}

function detectFormat(buffer, fileName) {
  const hit = ADAPTERS.find((a) => {
    try { return a.detect(buffer, fileName); } catch (e) { return false; }
  });
  return hit ? hit.key : null;
}

/**
 * Parse a bank statement into the ReconciliationSession contract.
 * @param {Buffer|string} input  file buffer (or path, for CLI testing)
 * @param {object} opts { fileName, format, contraMap }
 *   - format: force a specific adapter; omit to auto-detect.
 * @returns {{ meta, lines, totals }}
 */
function parseBankStatement(input, opts = {}) {
  const { fileName = null, format = null, contraMap = {} } = opts;

  // For detection we need a buffer; if given a path, read it (CLI/testing only).
  let buffer = input;
  if (typeof input === 'string') {
    // eslint-disable-next-line global-require
    buffer = require('fs').readFileSync(input);
  }

  const chosen = format || detectFormat(buffer, fileName);
  if (!chosen) {
    throw new Error('Unrecognized bank statement format. Supported: ' +
      ADAPTERS.map((a) => a.label).join(', ') + '.');
  }

  const adapter = getAdapter(chosen);
  if (!adapter) throw new Error('No adapter registered for format: ' + chosen);

  return adapter.parse(buffer, { filename: fileName, contraMap });
}

module.exports = { parseBankStatement, detectFormat, listFormats };
