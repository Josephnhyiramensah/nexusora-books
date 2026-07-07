import { useState, useEffect } from 'react';
import { FiPercent } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';

export default function TaxPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    api.get('/tax/summary').then(({ data: r }) => { if (r.success) setData(r.data); })
    .catch(() => showToast('Failed to load tax summary', 'error'))
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Loading tax summary...</p>;
  if (!data) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>No tax data available.</p>;

  const Card = ({ title, items, color }) => (
    <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', borderLeft: `4px solid ${color}`, padding: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</h3>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid #F5F5F5' : 'none', fontSize: 14 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: item.highlight ? color : 'var(--text-primary)' }}>{formatCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {ToastComponent}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>Tax Overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        <Card title="VAT / GST" color="#2563EB" items={[
          { label: 'VAT Collected (Output)', value: data.vat.collected },
          { label: 'VAT Paid (Input)', value: data.vat.paid },
          { label: 'Net VAT Payable', value: data.vat.net, highlight: true },
          { label: 'Tax Account Balance (2400)', value: data.vat.payable },
        ]} />

        <Card title="PAYE (Income Tax)" color="#DC2626" items={[
          { label: 'Total PAYE Deducted', value: data.paye.total, highlight: true },
          { label: 'Payroll Runs Processed', value: data.payrollRunCount },
        ]} />

        <Card title="SSNIT Contributions" color="#16A34A" items={[
          { label: 'Total SSNIT (Employee + Employer)', value: data.ssnit.total },
          { label: 'SSNIT Payable Balance (2500)', value: data.ssnit.payable, highlight: true },
        ]} />
      </div>

      <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
        Tax figures are derived from posted invoices, approved bills, and approved payroll runs. Consult a licensed accountant for official GRA filings.
      </div>
    </div>
  );
}