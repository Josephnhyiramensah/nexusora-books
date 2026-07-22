// client/src/modules/reports/ReportShared.jsx

import { FiPrinter, FiDownload } from 'react-icons/fi';
import ExcelJS from 'exceljs';

export function ReportHeader({ title, subtitle, companyName }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid var(--deep-navy)' }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--nexusora-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {companyName || 'Company'}
      </h2>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        {title}
      </h1>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

export function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Period:</label>
      <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)}
        style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none' }} />
      <span style={{ color: 'var(--text-muted)' }}>to</span>
      <input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)}
        style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none' }} />
    </div>
  );
}

export function ExportBar({ onPrint, onExportCSV, onExportExcel }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onPrint} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: '#fff',
      }}>
        <FiPrinter size={14} /> Print
      </button>
      <button onClick={onExportExcel || onExportCSV} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 'var(--radius-sm)', border: '1px solid var(--nexusora-gold, #C9A227)',
        fontSize: 12, fontWeight: 600, color: '#B8860B', background: '#fff',
      }}>
        <FiDownload size={14} /> Export Excel
      </button>
    </div>
  );
}

export function exportToCSV(filename, headers, rows) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Brand palette (matches the app design tokens).
const NAVY = 'FF1A3560';
const GOLD = 'FFC9A227';
const LIGHT = 'FFF2F6FA';
const WHITE = 'FFFFFFFF';
const BORDER = 'FFE2E8F0';

/**
 * Build and download a professionally-styled .xlsx for an accounting report.
 *
 * @param {object} opts
 *   filename    – base filename (date is appended)
 *   companyName – shown in the title block (gold)
 *   title       – report title (e.g. "General Ledger")
 *   subtitle    – e.g. the period string
 *   columns     – [{ header, key, width, money?:bool, align? }]
 *   sections    – [{ label, rows:[{...}], totalLabel?, totalValues?:{key:val} }]
 *                 A section with a label renders a shaded band; rows are data;
 *                 an optional bold total row closes it.
 */
export async function exportToExcelStyled({ filename, companyName, title, subtitle, columns, sections }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nexusora Books';
  wb.created = new Date();
  const ws = wb.addWorksheet(title || 'Report', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
  });

  const colCount = columns.length;
  const lastColLetter = String.fromCharCode(64 + colCount);

  // Column widths.
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width || 16 }));

  // ── Title block ──
  ws.mergeCells(`A1:${lastColLetter}1`);
  const cName = ws.getCell('A1');
  cName.value = (companyName || 'Company').toUpperCase();
  cName.font = { name: 'Calibri', size: 12, bold: true, color: { argb: GOLD } };
  cName.alignment = { horizontal: 'center' };

  ws.mergeCells(`A2:${lastColLetter}2`);
  const cTitle = ws.getCell('A2');
  cTitle.value = title || 'Report';
  cTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: NAVY } };
  cTitle.alignment = { horizontal: 'center' };

  if (subtitle) {
    ws.mergeCells(`A3:${lastColLetter}3`);
    const cSub = ws.getCell('A3');
    cSub.value = subtitle;
    cSub.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
    cSub.alignment = { horizontal: 'center' };
  }

  let r = subtitle ? 5 : 4;

  // ── Header row ──
  const headerRow = ws.getRow(r);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: c.align || (c.money ? 'right' : 'left'), vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: NAVY } } };
  });
  headerRow.height = 20;
  ws.views = [{ state: 'frozen', ySplit: r }];
  r += 1;

  const moneyFmt = '#,##0.00';

  // ── Sections ──
  sections.forEach((section) => {
    // Section band. Two modes:
    //  - section.bandValues: place values in specific columns (by key), shading
    //    the whole band row but keeping columns distinct (grouped-table look).
    //  - section.label: legacy single merged banner across all columns.
    if (section.bandValues) {
      const bandRow = ws.getRow(r);
      columns.forEach((c, i) => {
        const cell = bandRow.getCell(i + 1);
        const val = section.bandValues[c.key];
        if (val !== undefined) cell.value = val;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
        cell.alignment = { horizontal: c.align || (c.money ? 'right' : 'left'), vertical: 'middle' };
      });
      bandRow.height = 18;
      r += 1;
    } else if (section.label) {
      ws.mergeCells(`A${r}:${lastColLetter}${r}`);
      const band = ws.getCell(`A${r}`);
      band.value = section.label;
      band.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
      band.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
      band.alignment = { horizontal: 'left', vertical: 'middle' };
      ws.getRow(r).height = 18;
      r += 1;
    }

    // Data rows.
    (section.rows || []).forEach((row) => {
      const rr = ws.getRow(r);
      columns.forEach((c, i) => {
        const cell = rr.getCell(i + 1);
        const val = row[c.key];
        cell.value = (val === '' || val === undefined || val === null) ? '' : val;
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
        cell.alignment = { horizontal: c.align || (c.money ? 'right' : 'left') };
        if (c.money && typeof val === 'number') cell.numFmt = moneyFmt;
        cell.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
      });
      r += 1;
    });

   // Total row. The label can target a specific column via totalLabelKey
    // (defaults to the first column); values go in their keyed columns.
    if (section.totalLabel) {
      const tr = ws.getRow(r);
      const labelKey = section.totalLabelKey || columns[0].key;
      columns.forEach((c, i) => {
        const cell = tr.getCell(i + 1);
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
        cell.border = { top: { style: 'thin', color: { argb: NAVY } } };
        cell.alignment = { horizontal: c.align || (c.money ? 'right' : 'left') };
        if (c.key === labelKey) {
          cell.value = section.totalLabel;
        } else if (section.totalValues && section.totalValues[c.key] !== undefined) {
          cell.value = section.totalValues[c.key];
          if (c.money) cell.numFmt = moneyFmt;
        }
      });
      r += 1;
    }

    r += 1; // gap between sections
  });

  // Download.
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}