import { useState, useEffect, useRef } from 'react';
import reportService from '../../services/reportService';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { ReportHeader, ExportBar, exportToCSV, printReport, exportToExcelStyled } from './ReportShared';export default function BalanceSheetPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const { companyName, settings } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const printRef = useRef(null);

  useEffect(() => {
    reportService.balanceSheet()
      .then((r) => { if (r.success) setReport(r.data); })
      .catch(() => showToast('Failed to load report', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = () => printReport(printRef.current, 'Balance Sheet');

  const handleCSV = () => {
    if (!report) return;
    const rows = [];
    rows.push(['--- ASSETS ---', '']);
    report.assets.items.forEach((i) => rows.push([`${i.code} ${i.name}`, i.balance.toFixed(2)]));
    rows.push(['Total Assets', report.assets.total.toFixed(2)]);
    rows.push(['--- LIABILITIES ---', '']);
    report.liabilities.items.forEach((i) => rows.push([`${i.code} ${i.name}`, i.balance.toFixed(2)]));
    rows.push(['Total Liabilities', report.liabilities.total.toFixed(2)]);
    rows.push(['--- EQUITY ---', '']);
    report.equity.items.forEach((i) => rows.push([`${i.code} ${i.name}`, i.balance.toFixed(2)]));
    rows.push(['Total Equity', report.equity.total.toFixed(2)]);
    exportToCSV('balance_sheet', ['Account', 'Amount (GHS)'], rows);
  };

  const handleExcel = async () => {
    if (!report) return;
    const columns = [
      { header: 'Code', key: 'code', width: 12 },
      { header: 'Account', key: 'name', width: 44 },
      { header: 'Amount', key: 'amount', width: 18, money: true },
    ];
    const mk = (label, block, totalLabel) => ({
      bandValues: { code: '', name: label },
      rows: (block.items || []).map((i) => ({ code: i.code, name: i.name, amount: i.balance })),
      totalLabel,
      totalLabelKey: 'name',
      totalValues: { amount: block.total },
    });
    await exportToExcelStyled({
      filename: 'balance_sheet',
      companyName,
      title: 'Balance Sheet',
      subtitle: `As at ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      columns,
      sections: [
        mk('ASSETS', report.assets, 'Total Assets'),
        mk('LIABILITIES', report.liabilities, 'Total Liabilities'),
        mk('EQUITY', report.equity, 'Total Equity'),
      ],
    });
  };

  const Section = ({ title, items, total, color }) => (
    <>
      <tr style={{ background: 'var(--bg-app)' }}>
        <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, color: color || 'var(--deep-navy)' }}>{title}</td>
      </tr>
      {items.map((item, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
          <td style={{ padding: '8px 12px 8px 28px', fontSize: 13 }}>
            {item.code !== '—' && <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginRight: 8, fontSize: 12 }}>{item.code}</span>}
            {item.name}
          </td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{item.balance.toFixed(2)}</td>
        </tr>
      ))}
      <tr style={{ borderBottom: '2px solid var(--border)' }}>
        <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>Total {title}</td>
        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{total.toFixed(2)}</td>
      </tr>
    </>
  );

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Generating report...</p>;
  if (!report) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>No data.</p>;

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Balance Sheet</h1>
        <ExportBar onPrint={handlePrint} onExportExcel={handleExcel} />
      </div>

      <div ref={printRef} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 32 }}>
        <ReportHeader title="Balance Sheet" subtitle={`As at ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`} companyName={companyName} settings={settings} />

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Section title="Assets" items={report.assets.items} total={report.assets.total} color="#0D9488" />
            <Section title="Liabilities" items={report.liabilities.items} total={report.liabilities.total} color="#DC2626" />
            <Section title="Equity" items={report.equity.items} total={report.equity.total} color="#7C3AED" />

            <tr style={{ background: report.isBalanced ? '#D1FAE5' : '#FEE2E2', borderTop: '3px solid var(--deep-navy)' }}>
              <td style={{ padding: '14px 12px', fontWeight: 700, fontSize: 14 }}>
                Total Liabilities + Equity
              </td>
              <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
                {report.totalLiabilitiesAndEquity.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
          background: report.isBalanced ? '#D1FAE5' : '#FEE2E2',
          color: report.isBalanced ? '#065F46' : '#991B1B',
          fontSize: 13, fontWeight: 600, textAlign: 'center',
        }}>
          {report.isBalanced
            ? `✓ Balance Sheet is balanced — Assets (${report.assets.total.toFixed(2)}) = Liabilities + Equity (${report.totalLiabilitiesAndEquity.toFixed(2)})`
            : '✗ Balance Sheet is NOT balanced — please review accounts'}
        </div>
      </div>
    </div>
  );
}