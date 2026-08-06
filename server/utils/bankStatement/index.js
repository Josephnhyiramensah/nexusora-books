'use strict';
const { fidelityToSessionLines } = require('./fidelityToSessionLines');
const { readTabular } = require('./genericTabularReader');
const { applyColumnMapping } = require('./applyColumnMapping');
const { classifyBucket } = require('./bankBucketClassifier');
const crypto = require('crypto');

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
];

function detectFidelity(buffer) {
  try {
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

function toBuffer(input) {
  if (typeof input === 'string') return require('fs').readFileSync(input);
  return input;
}

function parseBankStatement(input, opts = {}) {
  const { fileName = null, format = null, contraMap = {} } = opts;
  const buffer = toBuffer(input);
  const chosen = format || detectFormat(buffer, fileName);
  if (!chosen) {
    const e = new Error('UNRECOGNIZED_FORMAT');
    e.code = 'UNRECOGNIZED_FORMAT';
    throw e;
  }
  const adapter = getAdapter(chosen);
  if (!adapter) throw new Error('No adapter registered for format: ' + chosen);
  return adapter.parse(buffer, { filename: fileName, contraMap });
}

function previewColumns(input) {
  const buffer = toBuffer(input);
  const t = readTabular(buffer, { sampleCount: 4 });
  return {
    sheetName: t.sheetName,
    sheetCount: t.sheetCount,
    headerRowIndex: t.headerRowIndex,
    totalRows: t.totalRows,
    columns: t.columns,
    previewRows: t.previewRows,
    meta: t.meta || null,
    warnings: t.warnings || [],
  };
}

function parseWithMapping(input, mapping, opts = {}) {
  const { contraMap = {} } = opts;
  const buffer = toBuffer(input);
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const t = readTabular(buffer);
  const res = applyColumnMapping(t.grid, mapping, { fileHash });

  if (!res || !res.ok) return res;

  res.lines = res.lines.map((l) => {
    const { bucket, confidence } = classifyBucket({ type: l.description, description: l.description, signed: l.signed });
    const suggestedContra = Object.prototype.hasOwnProperty.call(contraMap, bucket) ? contraMap[bucket] : null;
    return Object.assign(l, {
      type: (l.description || 'BANK').split(';')[0].slice(0, 40),
      bucket, bucketConfidence: confidence, suggestedContra,
    });
  });
  res.meta = res.meta || {};
  res.meta.fileHash = fileHash;
  return res;
}

module.exports = { parseBankStatement, detectFormat, listFormats, previewColumns, parseWithMapping };
