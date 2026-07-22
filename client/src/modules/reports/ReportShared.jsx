// client/src/modules/reports/ReportShared.jsx

import { FiPrinter, FiDownload } from 'react-icons/fi';
import ExcelJS from 'exceljs';

// NOTE: colours are hard-coded hex, not CSS variables. The print window is a
// fresh document without the app stylesheet, so var(--…) would resolve to
// nothing and the header would print black.
export function ReportHeader({ title, subtitle, companyName, settings }) {
  const s = settings || {};
  const lh = s.letterhead || {};
  const displayName = lh.companyName || companyName || 'Company';
  const addressLine = lh.address || [s.address, s.city, s.region].filter(Boolean).join(', ');
  const contactBits = [lh.phone, lh.email, lh.website].filter(Boolean);

  const titleBlock = (
    <div style={{ textAlign: 'center', marginTop: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A3560', margin: '0 0 4px' }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>{subtitle}</p>}
    </div>
  );

  // 1) Tenant uploaded a letterhead — it becomes the page header.
  if (s.letterheadImage) {
    return (
      <div style={{ marginBottom: 26 }}>
        <img src={s.letterheadImage} alt="" style={{ width: '100%', maxHeight: 150, objectFit: 'contain', display: 'block' }} />
        <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 12 }}>
          <div style={{ flex: 3, background: '#1A3560' }} />
          <div style={{ flex: 1, background: '#C9A227' }} />
        </div>
        {titleBlock}
      </div>
    );
  }

  // 2) Fallback — build a branded header from the company details on file.
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          {s.logo && <img src={s.logo} alt="" style={{ width: 58, height: 58, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#1A3560', lineHeight: 1.2 }}>{displayName}</div>
            {lh.tagline && <div style={{ fontSize: 12, fontStyle: 'italic', color: '#C9A227', marginTop: 3 }}>{lh.tagline}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#6B7280', lineHeight: 1.7, flexShrink: 0 }}>
          {addressLine && <div>{addressLine}</div>}
          {contactBits.map((b, i) => <div key={i}>{b}</div>)}
          {s.taxId && <div style={{ color: '#1A3560', fontWeight: 700, marginTop: 2 }}>TIN: {s.taxId}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ flex: 3, background: '#1A3560' }} />
        <div style={{ flex: 1, background: '#C9A227' }} />
      </div>
      {titleBlock}
    </div>
  );
}

/**
 * Open a print window for a report node and trigger the print dialog.
 * Waits for images (letterhead/logo) to finish loading first — otherwise the
 * saved PDF can come out with a blank header. A4 page size and
 * print-color-adjust keep the branding intact in the PDF.
 */
export function printReport(node, title) {
  if (!node) return;
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print this report.'); return; }

  win.document.write(`<html><head><title>${title || 'Report'}</title><style>
@page { size: A4; margin: 14mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
body { font-family: 'Inter', Arial, Helvetica, sans-serif; color: #1A3560; margin: 0; }
img { max-width: 100%; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 7px 10px; border-bottom: 1px solid #E2E8F0; }
.right { text-align: right; }
</style></head><body>`);
  win.document.write(node.innerHTML);
  win.document.write('</body></html>');
  win.document.close();

  let printed = false;
  const go = () => { if (printed) return; printed = true; win.focus(); win.print(); };
  const pending = Array.from(win.document.images || []).filter((im) => !im.complete);
  if (pending.length === 0) {
    setTimeout(go, 150);
  } else {
    let left = pending.length;
    pending.forEach((im) => {
      const done = () => { left -= 1; if (left === 0) go(); };
      im.onload = done;
      im.onerror = done;
    });
  }
  setTimeout(go, 3000); // safety net if an image never settles
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