import ExcelJS from 'exceljs';

const NAVY = 'FF1A3560';
const GOLD = 'FFC9A227';
const WHITE = 'FFFFFFFF';
const GREY = 'FFF3F4F6';
const MONEY = '#,##0.00';

function titleBlock(ws, lastCol, companyName, heading, sub) {
  ws.mergeCells(`A1:${lastCol}1`);
  const a = ws.getCell('A1');
  a.value = (companyName || 'Company').toUpperCase();
  a.font = { name: 'Calibri', size: 13, bold: true, color: { argb: GOLD } };
  a.alignment = { horizontal: 'center' };

  ws.mergeCells(`A2:${lastCol}2`);
  const b = ws.getCell('A2');
  b.value = heading;
  b.font = { name: 'Calibri', size: 16, bold: true, color: { argb: NAVY } };
  b.alignment = { horizontal: 'center' };

  ws.mergeCells(`A3:${lastCol}3`);
  const c = ws.getCell('A3');
  c.value = sub || '';
  c.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
  c.alignment = { horizontal: 'center' };
}

function save(wb, filename) {
  return wb.xlsx.writeBuffer().then((buf) => {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

/**
 * Bulk casual worker payment sheet — the one that goes on the clipboard for
 * workers to sign against on collection. The Signature column is deliberately
 * left empty and made wide enough to sign in.
 */
export async function exportCasualSheetExcel({ companyName, sheet }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nexusora Books';
  wb.created = new Date();

  const ws = wb.addWorksheet('Casual Payment', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
  });

  const cols = [
    { header: 'No', width: 6 },
    { header: 'Name of Worker', width: 30 },
    { header: 'Rate', width: 13 },
    { header: 'No. of Days', width: 13 },
    { header: 'Amount', width: 15 },
    { header: 'Signature', width: 26 },
  ];
  ws.columns = cols.map((c) => ({ width: c.width }));

  const dateStr = sheet.date ? new Date(sheet.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  titleBlock(ws, 'F', companyName, 'CASUAL WORKER PAYMENT SHEET',
    [sheet.title, sheet.periodLabel, dateStr, sheet.sheetNumber].filter(Boolean).join('  ·  '));

  let r = 5;
  const head = ws.getRow(r);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: i === 0 || i === 1 ? 'left' : i === 5 ? 'center' : 'right', vertical: 'middle' };
  });
  head.height = 24;
  r += 1;

  const lines = sheet.lines || [];
  lines.forEach((l, idx) => {
    const row = ws.getRow(r);
    const vals = [idx + 1, l.workerName || '', Number(l.rate || 0), Number(l.days || 0), Number(l.amount || 0), ''];
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 11 };
      if (i === 2 || i === 4) { cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' }; }
      if (i === 3) cell.alignment = { horizontal: 'right' };
      if (i === 4) cell.font = { name: 'Calibri', size: 11, bold: true };
      if (idx % 2 === 1 && i !== 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
    });
    row.height = 26;
    r += 1;
  });

  const tot = ws.getRow(r);
  ['', 'TOTAL', '', '', Number(sheet.totalAmount || 0), ''].forEach((v, i) => {
    const cell = tot.getCell(i + 1);
    cell.value = v;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
    cell.border = { top: { style: 'thin', color: { argb: NAVY } }, bottom: { style: 'double', color: { argb: NAVY } } };
    if (i === 4) { cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' }; }
  });
  r += 3;

  ws.getCell(`B${r}`).value = 'Prepared by: ..................................';
  ws.getCell(`E${r}`).value = 'Approved by: ..................................';
  [`B${r}`, `E${r}`].forEach((k) => { ws.getCell(k).font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } }; });

  await save(wb, `${sheet.sheetNumber || 'casual-payment'}.xlsx`);
}

/**
 * Per-person payment slip. One worker, one sheet — for individual records or
 * where each worker is paid separately.
 */
export async function exportCasualSlipExcel({ companyName, sheet, line, index }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nexusora Books';

  const ws = wb.addWorksheet('Payment Slip', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1,
      margins: { left: 0.7, right: 0.7, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 } },
  });
  ws.columns = [{ width: 26 }, { width: 30 }];

  const dateStr = sheet.date ? new Date(sheet.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  titleBlock(ws, 'B', companyName, 'CASUAL WORKER PAYMENT SLIP',
    [sheet.periodLabel, dateStr].filter(Boolean).join('  ·  '));

  let r = 5;
  const rows = [
    ['Slip Reference', `${sheet.sheetNumber || ''}${index !== undefined ? ' / ' + (index + 1) : ''}`],
    ['Worker Name', line.workerName || ''],
    ['Daily Rate (GHS)', Number(line.rate || 0)],
    ['Number of Days', Number(line.days || 0)],
    ['Amount Payable (GHS)', Number(line.amount || 0)],
  ];
  rows.forEach(([k, v], i) => {
    const row = ws.getRow(r);
    const a = row.getCell(1);
    const b = row.getCell(2);
    a.value = k;
    a.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
    b.value = v;
    b.font = { name: 'Calibri', size: 11, bold: i === rows.length - 1 };
    if (typeof v === 'number' && (i === 2 || i === 4)) { b.numFmt = MONEY; b.alignment = { horizontal: 'right' }; }
    a.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    b.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    row.height = 24;
    r += 1;
  });

  if (line.note) {
    r += 1;
    ws.getCell(`A${r}`).value = 'Note';
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
    ws.getCell(`B${r}`).value = line.note;
    r += 1;
  }

  r += 3;
  ws.getCell(`A${r}`).value = 'Received by: ..................................';
  ws.getCell(`B${r}`).value = 'Date: ..........................';
  [`A${r}`, `B${r}`].forEach((k) => { ws.getCell(k).font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } }; });

  const safe = String(line.workerName || 'worker').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await save(wb, `${sheet.sheetNumber || 'slip'}-${safe}.xlsx`);
}
