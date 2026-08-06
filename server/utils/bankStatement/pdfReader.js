'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'pdf_extract.py');
const PYTHON = process.env.PDF_PYTHON || 'python3';

// True if the buffer is a PDF. Tolerates a leading UTF-8/UTF-16 BOM or a little
// whitespace before the %PDF- signature (some banks' exports carry a BOM). Used
// by the dispatcher to route uploads to the PDF lane instead of the xlsx/csv
// tabular reader.
function isPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) return false;
  const head = buffer.slice(0, 1024).toString('latin1');
  const idx = head.indexOf('%PDF-');
  return idx >= 0 && idx <= 8;
}

// Extract a statement PDF into the SAME shape genericTabularReader.readTabular
// returns, so the mapper / balance-gate / fingerprint pipeline works unchanged.
// Runs the pdfplumber script synchronously (matching the sync tabular reader),
// piping the PDF over stdin. Throws typed errors the controller already maps to
// clean 4xx: NO_PDF_ENGINE (python/pdfplumber missing) and EMPTY_OR_SCAN.
function pdfReader(buffer) {
  const res = spawnSync(PYTHON, [SCRIPT, '-'], {
    input: buffer,
    maxBuffer: 32 * 1024 * 1024,
  });

  if (res.error) {
    const e = new Error('PDF engine not available: ' + res.error.message);
    e.code = 'NO_PDF_ENGINE';
    throw e;
  }
  if (res.status !== 0) {
    const e = new Error('PDF extraction failed: ' +
      (res.stderr ? res.stderr.toString().slice(0, 300) : 'exit ' + res.status));
    e.code = 'EMPTY_OR_SCAN';
    throw e;
  }

  let data;
  try {
    data = JSON.parse(res.stdout.toString('utf8'));
  } catch (pe) {
    const e = new Error('PDF extractor returned invalid output.');
    e.code = 'EMPTY_OR_SCAN';
    throw e;
  }
  if (!data || !data.ok) {
    const e = new Error((data && data.message) || 'Could not read PDF.');
    e.code = (data && data.code) || 'EMPTY_OR_SCAN';
    throw e;
  }

  return {
    sheetName: data.sheetName || 'PDF',
    sheetCount: data.sheetCount || 1,
    headerRowIndex: data.headerRowIndex || 0,
    totalRows: data.totalRows || (data.grid ? data.grid.length : 0),
    columns: data.columns || [],
    previewRows: data.previewRows || [],
    grid: data.grid || [],
    meta: data.meta || {},
    warnings: data.warnings || [],
  };
}

module.exports = { pdfReader, isPdf };
