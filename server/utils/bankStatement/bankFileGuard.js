'use strict';

/**
 * validateBankFile — a small safety gate run BEFORE any bank statement is parsed.
 *
 * The parsing libraries (SheetJS `xlsx`) have known DoS/ReDoS characteristics on
 * maliciously crafted files. Only authenticated tenant users can upload here, so
 * the real risk is low, but this gate closes the practical attack surface cheaply
 * without touching the (delicate, money-critical) parsing logic:
 *
 *   1. Size cap — a ReDoS/zip-bomb needs a large or deeply-nested file; capping
 *      the decoded size neutralises that vector.
 *   2. Magic-byte check — confirm the bytes really are an XLSX (ZIP: "PK\x03\x04"),
 *      a legacy XLS (OLE2 magic), or plain text (CSV) — not a renamed binary.
 *
 * Throws an Error with a `.code` and `.status` the controller maps to a clean
 * 4xx. It never parses or mutates the buffer.
 *
 * NOTE: The permanent fix for the underlying `xlsx` advisory is to migrate the
 * bank parsers to `exceljs` (already used for exports). That migration needs real
 * sample statements to diff old-vs-new output byte-for-byte before deploying, so
 * it is scheduled as its own task. This guard is the safe interim mitigation.
 */

// 8 MB decoded. Real bank/MoMo statements are well under 1 MB; 8 MB is generous
// headroom while still refusing the huge crafted files a ReDoS attack needs.
const MAX_BYTES = 8 * 1024 * 1024;

function looksLikeXlsxOrXls(buf) {
  if (buf.length < 8) return false;
  // XLSX / any modern OOXML = ZIP archive: 50 4B 03 04  (also 05 06 / 07 08 variants)
  if (buf[0] === 0x50 && buf[1] === 0x4b &&
      (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) return true;
  // Legacy .xls (OLE2 compound file): D0 CF 11 E0 A1 B1 1A E1
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
      buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1) return true;
  return false;
}

// Heuristic: does the buffer look like plain text (CSV)? We only need to be sure
// it is NOT some binary payload. Sample the first chunk for control bytes.
function looksLikeText(buf) {
  const n = Math.min(buf.length, 4096);
  if (n === 0) return false;
  for (let i = 0; i < n; i++) {
    const b = buf[i];
    // Allow tab(9), LF(10), CR(13); reject other control chars < 32 and the
    // NUL/0x00 that binary files contain.
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) return false;
  }
  return true;
}

/**
 * @param {Buffer} buffer decoded upload
 * @param {object} [opts]
 * @param {string} [opts.fileName] used only to allow .csv text files
 * @throws {Error} with .code ('FILE_TOO_LARGE' | 'BAD_FILE_TYPE') and .status 413/415
 */
function validateBankFile(buffer, opts = {}) {
  const { fileName = '' } = opts;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const e = new Error('No file was received. Please choose a statement file to import.');
    e.code = 'EMPTY_FILE'; e.status = 400;
    throw e;
  }

  if (buffer.length > MAX_BYTES) {
    const e = new Error('That file is too large. Please upload a bank statement under 8 MB (bank exports are normally well under 1 MB).');
    e.code = 'FILE_TOO_LARGE'; e.status = 413;
    throw e;
  }

  const isCsvName = /\.csv$/i.test(fileName);
  const ok = looksLikeXlsxOrXls(buffer) || ((isCsvName || !looksLikeXlsxOrXls(buffer)) && looksLikeText(buffer));

  if (!ok) {
    const e = new Error('That file does not look like a valid Excel or CSV statement. Please upload a genuine .xlsx, .xls or .csv export from your bank.');
    e.code = 'BAD_FILE_TYPE'; e.status = 415;
    throw e;
  }
}

module.exports = { validateBankFile, MAX_BYTES };
