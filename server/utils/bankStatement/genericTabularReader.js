'use strict';

/**
 * genericTabularReader
 * --------------------
 * Reads ANY xlsx/xls/csv into a neutral structure the column-mapper UI can
 * present: detected header row, column list, and sample data rows. Knows
 * nothing about any bank — it just says "here are your columns and some
 * example values". No DB, no ledger.
 *
 *   readTabular(input, opts) -> {
 *     sheetName, totalRows,
 *     headerRowIndex,            // 0-based guess
 *     columns: [{ index, header, samples:[...] }],
 *     previewRows: [ [c0,c1,...], ... ],   // first few data rows, raw
 *     grid                        // full raw grid (arrays), for the normalizer
 *   }
 */

const XLSX = require('xlsx');

function readGrid(input) {
  let buf = input;
  if (typeof input === 'string') buf = require('fs').readFileSync(input);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('genericTabularReader: workbook has no sheets');
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  return { sheetName, grid };
}

const isTextLabel = (v) => typeof v === 'string' && v.trim().length > 0 && !/^-?[\d,]+\.?\d*$/.test(v.trim());
const isNumeric = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && /^-?[\d,]+\.?\d*$/.test(v.trim().replace(/,/g, '')));

/**
 * Guess the header row: the row with the most non-empty TEXT cells and few
 * numbers, scanning the first ~15 rows. Falls back to row 0.
 */
function guessHeaderRow(grid) {
  let best = 0, bestScore = -1;
  const limit = Math.min(grid.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = grid[i] || [];
    const nonEmpty = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonEmpty.length < 2) continue;
    const textCount = row.filter(isTextLabel).length;
    const numCount = row.filter(isNumeric).length;
    // headers are mostly text, rarely numeric
    const score = textCount - numCount * 2;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

function readTabular(input, opts = {}) {
  const { sampleCount = 3 } = opts;
  const { sheetName, grid } = readGrid(input);
  if (!grid.length) {
    return { sheetName, totalRows: 0, headerRowIndex: 0, columns: [], previewRows: [], grid: [] };
  }

  const headerRowIndex = (opts.headerRowIndex != null) ? opts.headerRowIndex : guessHeaderRow(grid);
  const headerRow = grid[headerRowIndex] || [];
  const width = grid.reduce((w, r) => Math.max(w, r ? r.length : 0), 0);

  // data rows = everything after the header that has any content
  const dataRows = [];
  for (let i = headerRowIndex + 1; i < grid.length; i++) {
    const r = grid[i] || [];
    if (r.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) dataRows.push(r);
  }

  const columns = [];
  for (let c = 0; c < width; c++) {
    const rawHeader = headerRow[c];
    const header = (rawHeader === null || rawHeader === undefined) ? '' : String(rawHeader).trim();
    const samples = [];
    for (let i = 0; i < dataRows.length && samples.length < sampleCount; i++) {
      const v = dataRows[i][c];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        samples.push(v instanceof Date ? v.toISOString().slice(0, 10) : v);
      }
    }
    columns.push({ index: c, header, samples });
  }

  const previewRows = dataRows.slice(0, sampleCount).map((r) => {
    const out = [];
    for (let c = 0; c < width; c++) {
      const v = r[c];
      out.push(v instanceof Date ? v.toISOString().slice(0, 10) : (v == null ? '' : v));
    }
    return out;
  });

  return { sheetName, totalRows: dataRows.length, headerRowIndex, columns, previewRows, grid };
}

module.exports = { readTabular };
