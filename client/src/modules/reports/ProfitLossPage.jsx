import { useState, useEffect, useRef } from 'react';
import reportService from '../../services/reportService';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { ReportHeader, DateRangePicker, ExportBar, exportToCSV } from './ReportShared';

export default function ProfitLossPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { companyName } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const printRef = useRef(null);

  const fetchReport = () => {
    setLoading(true);
    reportService.profitLoss(startDate, endDate)
      .then((r) => { if (r.success) setReport(r.data); })
      .catch(() => showToast('Failed to load report', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReport(); }, [startDate, endDate]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Profit & Loss</title><style>
      body { font-family: 'Inter', sans-serif; padding: 40px; color: #1A3560; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { padding: 8px 12px; border-bottom: 1px solid #E2E8F0; }
      .section { background: #F2F6FA; font-weight: 600; } .total { font-weight: 700; }
      .right { text-align: right; } h1 { text-align: center; } h2 { text-align: center; color: #C9A227; font-size: 13px; }
    </style></head><body>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const handleCSV = () => {
    if (!report) return;
    const rows = [];
    rows.push(['--- REVENUE ---', '', '']);
    report.revenue.items.forEach((i) => rows.push([i.code, i.name, i.balance.toFixed(2)]));
    rows.push(['', 'Total Revenue', report.revenue.total.toFixed(2)]);
    rows.push(['--- COST OF GOODS SOLD ---', '', '']);
    report.costOfGoodsSold.items.forEach((i) => rows.push([i.code, i.name, i.balance.toFixed(2)]));
    rows.push(['', 'Total COGS', report.costOfGoodsSold.total.toFixed(2)]);
    rows.push(['', 'GROSS PROFIT', report.grossProfit.toFixed(2)]);
    rows.push(['--- OPERATING EXPENSES ---', '', '']);
    report.operatingExpenses.items.forEach((i) => rows.push([i.code, i.name, i.balance.toFixed(2)]));
    rows.push(['', 'Total Expenses', report.operatingExpenses.total.toFixed(2)]);
    rows.push(['', 'NET INCOME', report.netIncome.toFixed(2)]);
    exportToCSV('profit_and_loss', ['Code', 'Account', 'Amount'], rows);
  };

  const SectionRow = ({ label, items, total, totalLabel }) => (
    <>
      <tr style={{ background: 'var(--bg-app)' }}>
        <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, color: 'var(--deep-navy)' }}>{label}</td>
      </tr>
      {items.map((item, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
          <td style={{ padding: '8px 12px 8px 28px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{item.code}</td>
          <td style={{ padding: '8px 12px', fontSize: 13 }}>{item.name}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{item.balance.toFixed(2)}</td>
        </tr>
      ))}
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{totalLabel || `Total ${label}`}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{total.toFixed(2)}</td>
      </tr>
    </>
  );

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Generating report...</p>;

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Profit & Loss</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
          <ExportBar onPrint={handlePrint} onExportCSV={handleCSV} />
        </div>
      </div>

      {report && (
        <div ref={printRef} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 32 }}>
          <ReportHeader title="Profit & Loss (Income Statement)" subtitle={`For the period ${startDate} to ${endDate}`} companyName={companyName} />

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <SectionRow label="Revenue" items={report.revenue.items} total={report.revenue.total} totalLabel="Total Revenue" />
              <SectionRow label="Cost of Goods Sold" items={report.costOfGoodsSold.items} total={report.costOfGoodsSold.total} totalLabel="Total COGS" />

              <tr style={{ background: '#EBF5FF', borderTop: '2px solid var(--tech-blue)' }}>
                <td colSpan={2} style={{ padding: '12px 12px', fontWeight: 700, fontSize: 14, color: 'var(--deep-navy)' }}>GROSS PROFIT</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: report.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{report.grossProfit.toFixed(2)}</td>
              </tr>

              <SectionRow label="Operating Expenses" items={report.operatingExpenses.items} total={report.operatingExpenses.total} totalLabel="Total Operating Expenses" />

              <tr style={{ background: report.netIncome >= 0 ? '#D1FAE5' : '#FEE2E2', borderTop: '3px solid var(--deep-navy)' }}>
                <td colSpan={2} style={{ padding: '14px 12px', fontWeight: 700, fontSize: 16, color: 'var(--deep-navy)' }}>NET INCOME</td>
                <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: report.netIncome >= 0 ? '#065F46' : '#991B1B' }}>GHS {report.netIncome.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}