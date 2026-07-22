import { useState, useEffect, useRef } from 'react';
import reportService from '../../services/reportService';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { ReportHeader, ExportBar, exportToCSV, printReport, exportToExcelStyled } from './ReportShared';
export default function TrialBalancePage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const { companyName, settings } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const printRef = useRef(null);

  useEffect(() => {
    reportService.trialBalance()
      .then((r) => { if (r.success) setReport(r.data); })
      .catch(() => showToast('Failed to load report', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = () => printReport(printRef.current, 'Trial Balance');

  const handleCSV = () => {
    if (!report) return;
    exportToCSV('trial_balance',
      ['Code', 'Account Name', 'Type', 'Debit', 'Credit'],
      report.rows.map((r) => [r.code, r.name, r.type, r.debit.toFixed(2), r.credit.toFixed(2)])
    );
  };

  const handleExcel = async () => {
    if (!report) return;
    await exportToExcelStyled({
      filename: 'trial_balance',
      companyName,
      title: 'Trial Balance',
      subtitle: `As at ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      columns: [
        { header: 'Code', key: 'code', width: 12 },
        { header: 'Account Name', key: 'name', width: 38 },
        { header: 'Type', key: 'type', width: 16 },
        { header: 'Debit', key: 'debit', width: 16, money: true },
        { header: 'Credit', key: 'credit', width: 16, money: true },
      ],
      sections: [{
        rows: report.rows.map((r) => ({
          code: r.code, name: r.name, type: r.type,
          debit: r.debit || '', credit: r.credit || '',
        })),
        totalLabel: 'TOTAL',
        totalLabelKey: 'name',
        totalValues: { debit: report.totalDebit, credit: report.totalCredit },
      }],
    });
  };
  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Generating report...</p>;
  if (!report) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>No data available.</p>;

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Trial Balance</h1>
        <ExportBar onPrint={handlePrint} onExportExcel={handleExcel} />
      </div>

      <div ref={printRef} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 32 }}>
        <ReportHeader title="Trial Balance" subtitle={`As at ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`} companyName={companyName} />

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--deep-navy)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Account Name</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Debit (GHS)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Credit (GHS)</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.filter((r) => r.debit > 0 || r.credit > 0).map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{row.code}</td>
                <td style={{ padding: '9px 12px' }}>{row.name}</td>
                <td style={{ padding: '9px 12px', textTransform: 'capitalize', color: 'var(--text-muted)', fontSize: 12 }}>{row.type}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{row.debit > 0 ? row.debit.toFixed(2) : ''}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{row.credit > 0 ? row.credit.toFixed(2) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--deep-navy)', fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: '12px 12px', fontSize: 14 }}>TOTALS</td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14 }}>{report.totalDebit.toFixed(2)}</td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14 }}>{report.totalCredit.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
          background: report.isBalanced ? '#D1FAE5' : '#FEE2E2',
          color: report.isBalanced ? '#065F46' : '#991B1B',
          fontSize: 13, fontWeight: 600, textAlign: 'center',
        }}>
          {report.isBalanced ? '✓ Trial Balance is balanced' : `✗ Out of balance by ${Math.abs(report.difference).toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}