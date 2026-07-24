import ExcelJS from 'exceljs';

const NAVY = 'FF1A3560';
const GOLD = 'FFC9A227';
const WHITE = 'FFFFFFFF';
const GREY = 'FFF3F4F6';

const MONEY = '#,##0.00';

/**
 * Styled monthly staff payroll sheet.
 *
 * Written as its own builder rather than reusing exportToExcelStyled: that one
 * is shaped for grouped account sections in portrait, while a payroll sheet is
 * one flat 11-column table that needs landscape A4 to stay readable.
 */
export async function exportPayrollExcel({ companyName, run, periodLabel }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nexusora Books';
  wb.created = new Date();

  const ws = wb.addWorksheet('Payroll', {
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  const cols = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Name of Employee', key: 'name', width: 26 },
    { header: 'Basic Salary', key: 'basic', width: 14 },
    { header: 'SSNIT 5.5%', key: 'ssnit', width: 13 },
    { header: 'Prov. Fund', key: 'pf', width: 13 },
    { header: 'Deduction b/Tax', key: 'dbt', width: 16 },
    { header: 'Taxable Income', key: 'taxable', width: 15 },
    { header: 'PAYE', key: 'paye', width: 13 },
    { header: 'Loan', key: 'loan', width: 12 },
    { header: 'Total Deduction', key: 'totded', width: 16 },
    { header: 'Net Income', key: 'net', width: 15 },
  ];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));

  const last = 'K';

  ws.mergeCells(`A1:${last}1`);
  const t1 = ws.getCell('A1');
  t1.value = (companyName || 'Company').toUpperCase();
  t1.font = { name: 'Calibri', size: 13, bold: true, color: { argb: GOLD } };
  t1.alignment = { horizontal: 'center' };

  ws.mergeCells(`A2:${last}2`);
  const t2 = ws.getCell('A2');
  t2.value = 'STAFF PAYROLL SHEET';
  t2.font = { name: 'Calibri', size: 16, bold: true, color: { argb: NAVY } };
  t2.alignment = { horizontal: 'center' };

  ws.mergeCells(`A3:${last}3`);
  const t3 = ws.getCell('A3');
  t3.value = periodLabel || '';
  t3.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
  t3.alignment = { horizontal: 'center' };

  let r = 5;
  const head = ws.getRow(r);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: i < 2 ? 'left' : 'right', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: NAVY } } };
  });
  head.height = 28;
  r += 1;

  const entries = run.entries || [];
  entries.forEach((e, idx) => {
    const row = ws.getRow(r);
    const vals = [
      idx + 1,
      e.employeeName || [e.employee?.firstName, e.employee?.lastName].filter(Boolean).join(' ') || '',
      e.grossPay, e.employeeSsnit, e.providentFund, e.deductionBeforeTax,
      e.taxableIncome, e.paye, e.loanDeduction, e.totalDeduction, e.netPay,
    ];
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = i === 0 || i === 1 ? v : Number(v || 0);
      cell.font = { name: 'Calibri', size: 10 };
      if (i >= 2) { cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' }; }
      if (i === 10) cell.font = { name: 'Calibri', size: 10, bold: true };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
    });
    r += 1;
  });

  const tot = ws.getRow(r);
  const totals = [
    '', 'TOTALS',
    run.totalGross, run.totalEmployeeSsnit, run.totalProvidentFund,
    (run.totalEmployeeSsnit || 0) + (run.totalProvidentFund || 0),
    (run.totalGross || 0) - ((run.totalEmployeeSsnit || 0) + (run.totalProvidentFund || 0)),
    run.totalPaye, run.totalLoanDeduction, run.totalDeduction, run.totalNet,
  ];
  totals.forEach((v, i) => {
    const cell = tot.getCell(i + 1);
    cell.value = i <= 1 ? v : Number(v || 0);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: NAVY } };
    cell.border = { top: { style: 'thin', color: { argb: NAVY } }, bottom: { style: 'double', color: { argb: NAVY } } };
    if (i >= 2) { cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' }; }
  });
  r += 2;

  // Audit trail: the band schedule these figures were produced with.
  ws.mergeCells(`A${r}:${last}${r}`);
  const note = ws.getCell(`A${r}`);
  note.value = 'Computed using ' + (run.payeBandsLabel || 'the PAYE bands stored with this run')
    + '  |  SSNIT: 5.5% employee, 13% employer  |  Employer SSNIT: GHS '
    + Number(run.totalEmployerSsnit || 0).toFixed(2);
  note.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6B7280' } };

  ws.views = [{ state: 'frozen', ySplit: 5 }];

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (run.payrollNumber || 'payroll') + '.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
