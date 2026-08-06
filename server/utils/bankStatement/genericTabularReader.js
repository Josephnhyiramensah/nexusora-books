'use strict';

/**
 * genericTabularReader (hardened)
 * -------------------------------
 * Reads ANY xlsx/xls/csv into a neutral structure the column-mapper UI can
 * present. Knows nothing about any bank -- it just says "here are your columns
 * and some example values". No DB, no ledger.
 *
 * Hardening over v1:
 *   - Reads and STITCHES all sheets (PDF converters split one statement per page).
 *   - Detects the header row per sheet (a header has NO numeric cells), and
 *     treats continuation sheets (no header) correctly instead of eating a row.
 *   - Drops fully-empty spacer columns (PDF converters leave many).
 *   - REJECTS loudly on empty/scan-like input, and on structurally inconsistent
 *     multi-sheet files (typical of bad PDF->Excel conversions) rather than
 *     silently importing misaligned financial data.
 *   - Best-effort harvest of currency/account for UI auto-fill.
 *
 * Contract (field names unchanged; grid is now CLEANED + COMPACT):
 *   readTabular(input, opts) -> {
 *     sheetName,        // primary (first usable) sheet name
 *     sheetCount,       // number of sheets stitched
 *     totalRows,        // data-row count (excludes header)
 *     headerRowIndex,   // always 0 in the returned compact grid
 *     columns: [{ index, header, samples:[...] }],  // index into compact grid
 *     previewRows: [ [c0,c1,...], ... ],
 *     grid,             // [ compactHeaderRow, ...compactDataRows ]
 *     meta: { currency, account },   // best-effort, may be null
 *     warnings: [ ... ]
 *   }
 *
 * Throws Error with .code:
 *   'EMPTY_OR_SCAN'       -> no extractable table (empty export or scanned/image PDF)
 *   'INCONSISTENT_SHEETS' -> multi-sheet shapes disagree; route to PDF adapter / native export
 */

const XLSX = require('xlsx');

const cellStr = (v) => (v === null || v === undefined) ? '' : String(v).trim();
const isBlankCell = (v) => cellStr(v) === '';
const isTextLabel = (v) =>
  typeof v === 'string' && v.trim().length > 0 && !/^-?[\d,]+\.?\d*$/.test(v.trim());
const isNumericCell = (v) =>
  typeof v === 'number' ||
  (typeof v === 'string' && v.trim() !== '' && /^-?[\d,]+\.?\d*$/.test(v.trim().replace(/,/g, '')));

function readWorkbook(input) {
  let buf = input;
  if (typeof input === 'string') buf = require('fs').readFileSync(input);
  try {
    return XLSX.read(buf, { type: 'buffer', cellDates: true });
  } catch (err) {
    const e = new Error('Could not read this file as a spreadsheet. If it is a scanned or image-only document, it is not supported -- please provide a text-based CSV/Excel export.');
    e.code = 'EMPTY_OR_SCAN';
    throw e;
  }
}

function sheetToGrid(ws) {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
}

// A header row is mostly text with NO numeric cells (amounts live in data rows).
function guessHeaderRow(grid) {
  let best = -1, bestScore = -1;
  const limit = Math.min(grid.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = grid[i] || [];
    const nonEmpty = row.filter((c) => !isBlankCell(c));
    if (nonEmpty.length < 2) continue;
    const numCount = row.filter(isNumericCell).length;
    if (numCount > 0) continue;                 // reject transaction/metadata rows
    const textCount = row.filter(isTextLabel).length;
    if (textCount < 2) continue;
    if (textCount > bestScore) { bestScore = textCount; best = i; }
  }
  return best; // -1 => sheet has no header (continuation page)
}

function harvestMeta(grid, headerRowIndex) {
  const meta = { currency: null, account: null };
  const upto = headerRowIndex > 0 ? headerRowIndex : Math.min(grid.length, 12);
  for (let i = 0; i < upto; i++) {
    const cells = (grid[i] || []).map(cellStr).filter(Boolean);
    for (let j = 0; j < cells.length; j++) {
      const key = cells[j].toLowerCase().replace(/[:\s]+$/, '');
      const next = cells[j + 1];
      if (!next) continue;
      if (key === 'currency' && !meta.currency) meta.currency = next;
      if (key === 'account' && !meta.account) meta.account = next;
    }
  }
  return meta;
}

function nonEmptyColumns(dataRows, width) {
  const keep = [];
  for (let c = 0; c < width; c++) {
    for (let i = 0; i < dataRows.length; i++) {
      if (!isBlankCell(dataRows[i][c])) { keep.push(c); break; }
    }
  }
  return keep;
}

// Collapse one sheet -> compact { header, rows } with spacer columns removed.
function collapseSheet(grid) {
  const width = grid.reduce((w, r) => Math.max(w, r ? r.length : 0), 0);
  if (!width) return null;

  const hIdx = guessHeaderRow(grid);
  const headerRow = hIdx >= 0 ? (grid[hIdx] || []) : [];
  const startData = hIdx >= 0 ? hIdx + 1 : 0;

  const dataRows = [];
  for (let i = startData; i < grid.length; i++) {
    const r = grid[i] || [];
    if (r.some((c) => !isBlankCell(c))) dataRows.push(r);
  }
  if (!dataRows.length) return null;

  const keepCols = nonEmptyColumns(dataRows, width);
  const header = keepCols.map((c) => cellStr(headerRow[c]));
  const rows = dataRows.map((r) => keepCols.map((c) => {
    const v = r[c];
    return v instanceof Date ? v.toISOString().slice(0, 10) : (v == null ? '' : v);
  }));

  return { header, rows, hadHeader: hIdx >= 0, headerRowIndex: hIdx, rawGrid: grid };
}

function readTabular(input, opts = {}) {
  const { sampleCount = 3 } = opts;
  const wb = readWorkbook(input);
  const names = wb.SheetNames || [];
  if (!names.length) {
    const e = new Error('genericTabularReader: workbook has no sheets');
    e.code = 'EMPTY_OR_SCAN';
    throw e;
  }

  const collapsed = [];
  for (const name of names) {
    const c = collapseSheet(sheetToGrid(wb.Sheets[name]));
    if (c) collapsed.push({ name, ...c });
  }

  if (!collapsed.length) {
    const e = new Error('No extractable table found. This happens with empty exports or scanned/image PDFs, which are not supported. Please provide a text-based CSV/Excel export or a text (non-scanned) PDF.');
    e.code = 'EMPTY_OR_SCAN';
    throw e;
  }

  // Canonical column model: first sheet that actually has a header, else first.
  const canonical = collapsed.find((s) => s.hadHeader) || collapsed[0];
  const canonWidth = canonical.header.length;

  const warnings = [];
  const dataRows = [];
  let matched = 0;
  for (const s of collapsed) {
    if (s.header.length === canonWidth) { dataRows.push(...s.rows); matched++; }
    else warnings.push(`Sheet "${s.name}" has ${s.header.length} columns but the statement uses ${canonWidth}; not merged.`);
  }

  // Refuse to guess when sheets disagree -- misaligned money columns are worse
  // than a clear rejection on a live system. Route such files to the PDF importer.
  if (matched < collapsed.length) {
    const e = new Error(`This file's sheets have inconsistent column structures (common with PDF-to-Excel conversions). Use your bank's native CSV/Excel export, or import the original PDF through the bank importer. ${warnings.join(' ')}`);
    e.code = 'INCONSISTENT_SHEETS';
    e.warnings = warnings;
    throw e;
  }

  const header = canonical.header;
  const columns = header.map((h, c) => {
    const samples = [];
    for (let i = 0; i < dataRows.length && samples.length < sampleCount; i++) {
      const v = dataRows[i][c];
      if (!isBlankCell(v)) samples.push(v);
    }
    return { index: c, header: h, samples };
  });

  const previewRows = dataRows.slice(0, sampleCount).map((r) =>
    header.map((_, c) => (r[c] == null ? '' : r[c])));

  const grid = [header.slice(), ...dataRows];
  const meta = harvestMeta(canonical.rawGrid, canonical.headerRowIndex >= 0 ? canonical.headerRowIndex : 0);

  return {
    sheetName: canonical.name,
    sheetCount: collapsed.length,
    totalRows: dataRows.length,
    headerRowIndex: 0,
    columns,
    previewRows,
    grid,
    meta,
    warnings,
  };
}

module.exports = { readTabular };
