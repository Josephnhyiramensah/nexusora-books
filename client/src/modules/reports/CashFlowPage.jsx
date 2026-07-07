import { useState, useEffect, useRef } from 'react';
import reportService from '../../services/reportService';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { ReportHeader, DateRangePicker, ExportBar, exportToCSV } from './ReportShared';
import { formatDate } from '../../utils/formatters';

export default function CashFlowPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { companyName } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const printRef = useRef(null);

  const fetchReport = () => {
    setLoading(true);
    reportService.cashFlow(startDate, endDate)
      .then((r) => { if (r.success) setReport(r.data); })
      .catch(() => showToast('Failed', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReport(); }, [startDate, endDate]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Cash Flow</title><style>body{font-family:'Inter',sans-serif;padding:40px;color:#1A3560}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 12px;border-bottom:1px solid #E2E8F0}h1{text-align:center}h2{text-align:center;color:#C9A227;font-size:13px}</style></head><body>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const handleCSV = () => {
    if (!report) return;
    const rows = [];
    rows.push(['--- OPERATING ---', '', '']);
    report.operating.items.forEach((i) => rows.push([formatDate(i.date), i.description, i.amount.toFixed(2)]));
    rows.push(['', 'Total Operating', report.operating.total.toFixed(2)]);
    rows.push(['--- INVESTING ---', '', '']);
    report.investing.items.forEach((i) => rows.push([formatDate(i.date), i.description, i.amount.toFixed(2)]));
    rows.push(['', 'Total Investing', report.investing.total.toFixed(2)]);
    rows.push(['--- FINANCING ---', '', '']);
    report.financing.items.forEach((i) => rows.push([formatDate(i.date), i.description, i.amount.toFixed(2)]));
    rows.push(['', 'Total Financing', report.financing.total.toFixed(2)]);
    rows.push(['', 'NET CHANGE', report.netChange.toFixed(2)]);
    exportToCSV('cash_flow', ['Date', 'Description', 'Amount'], rows);
  };

  const CashSection = ({ title, items, total }) => (
    <>
      <tr style={{ background: 'var(--bg-app)' }}>
        <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, color: 'var(--deep-navy)' }}>{title}</td>
      </tr>
      {items.length === 0 ? (
        <tr><td colSpan={3} style={{ padding: '8px 12px 8px 28px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No transactions</td></tr>
      ) : items.map((item, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
          <td style={{ padding: '8px 12px 8px 28px', fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(item.date)}</td>
          <td style={{ padding: '8px 12px', fontSize: 13 }}>{item.description || item.entryNumber}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: item.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {item.amount >= 0 ? '' : '('}{Math.abs(item.amount).toFixed(2)}{item.amount < 0 ? ')' : ''}
          </td>
        </tr>
      ))}
      <tr style={{ borderBottom: '2px solid var(--border)' }}>
        <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>Net {title}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: total >= 0 ? 'var(--success)' : 'var(--danger)' }}>{total.toFixed(2)}</td>
      </tr>
    </>
  );

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Generating report...</p>;

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Cash Flow Statement</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
          <ExportBar onPrint={handlePrint} onExportCSV={handleCSV} />
        </div>
      </div>

      {report && (
        <div ref={printRef} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 32 }}>
          <ReportHeader title="Cash Flow Statement" subtitle={`For the period ${startDate} to ${endDate}`} companyName={companyName} />

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <CashSection title="Operating Activities" items={report.operating.items} total={report.operating.total} />
              <CashSection title="Investing Activities" items={report.investing.items} total={report.investing.total} />
              <CashSection title="Financing Activities" items={report.financing.items} total={report.financing.total} />

              <tr style={{ background: '#EBF5FF', borderTop: '3px solid var(--deep-navy)' }}>
                <td colSpan={2} style={{ padding: '14px 12px', fontWeight: 700, fontSize: 14 }}>Net Change in Cash</td>
                <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: report.netChange >= 0 ? '#065F46' : '#991B1B' }}>
                  GHS {report.netChange.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Current Cash Balance</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>GHS {report.currentCashBalance.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}