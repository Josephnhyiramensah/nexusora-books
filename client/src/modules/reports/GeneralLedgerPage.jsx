import { useState, useEffect, useRef } from 'react';
import reportService from '../../services/reportService';
import accountService from '../../services/accountService';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { ReportHeader, DateRangePicker, ExportBar, exportToCSV } from './ReportShared';
import { formatDate } from '../../utils/formatters';

export default function GeneralLedgerPage() {
  const [report, setReport] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { companyName } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const printRef = useRef(null);

  useEffect(() => {
    accountService.getAll({ isActive: 'true' }).then((r) => { if (r.success) setAccounts(r.data); }).catch(() => {});
  }, []);

  const fetchReport = () => {
    setLoading(true);
    reportService.generalLedger(selectedAccount || undefined, startDate, endDate)
      .then((r) => { if (r.success) setReport(r.data); })
      .catch(() => showToast('Failed', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReport(); }, [selectedAccount, startDate, endDate]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>General Ledger</title><style>body{font-family:'Inter',sans-serif;padding:40px;color:#1A3560;font-size:12px}table{width:100%;border-collapse:collapse}th,td{padding:6px 10px;border-bottom:1px solid #E2E8F0}th{background:#F2F6FA;font-weight:600}h1{text-align:center;font-size:18px}h2{text-align:center;color:#C9A227;font-size:12px}h3{margin-top:24px;padding:8px;background:#1A3560;color:#fff;font-size:13px}</style></head><body>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const handleCSV = () => {
    if (!report) return;
    const rows = [];
    report.accounts.forEach((acct) => {
      rows.push([`--- ${acct.code} ${acct.name} ---`, '', '', '', '']);
      acct.transactions.forEach((t) => rows.push([formatDate(t.date), t.entryNumber, t.description, t.debit.toFixed(2), t.credit.toFixed(2), t.balance.toFixed(2)]));
      rows.push(['', '', 'Closing Balance', '', '', acct.closingBalance.toFixed(2)]);
    });
    exportToCSV('general_ledger', ['Date', 'Entry #', 'Description', 'Debit', 'Credit', 'Balance'], rows);
  };

  if (loading && !report) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Generating report...</p>;

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>General Ledger</h1>
        <ExportBar onPrint={handlePrint} onExportCSV={handleCSV} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}
          style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff', minWidth: 260 }}>
          <option value="">All accounts with transactions</option>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
        </select>
        <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
      </div>

      {report && (
        <div ref={printRef}>
          {report.accounts.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No transactions found for the selected period.
            </div>
          ) : report.accounts.map((acct) => (
            <div key={acct.code} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'var(--deep-navy)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  <span style={{ fontFamily: 'monospace', marginRight: 10 }}>{acct.code}</span>
                  {acct.name}
                </span>
                <span style={{ fontSize: 12, opacity: 0.7, textTransform: 'capitalize' }}>{acct.type} • {acct.normalBalance} normal</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', width: '12%' }}>Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', width: '12%' }}>Entry #</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', width: '34%' }}>Description</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', width: '14%' }}>Debit</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', width: '14%' }}>Credit</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', width: '14%' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {acct.transactions.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 14px', fontSize: 12 }}>{formatDate(t.date)}</td>
                      <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 12 }}>{t.entryNumber}</td>
                      <td style={{ padding: '8px 14px' }}>{t.description}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{t.debit > 0 ? t.debit.toFixed(2) : ''}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{t.credit > 0 ? t.credit.toFixed(2) : ''}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{t.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--deep-navy)', fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: '10px 14px' }}>Closing Balance</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14 }}>{acct.closingBalance.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}