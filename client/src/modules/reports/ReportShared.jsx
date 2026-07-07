// client/src/modules/reports/ReportShared.jsx

import { FiPrinter, FiDownload } from 'react-icons/fi';

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

export function ExportBar({ onPrint, onExportCSV }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onPrint} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: '#fff',
      }}>
        <FiPrinter size={14} /> Print
      </button>
      <button onClick={onExportCSV} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: '#fff',
      }}>
        <FiDownload size={14} /> Export CSV
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