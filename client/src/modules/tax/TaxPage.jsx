import { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';

export default function TaxPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState('vat'); // which section is expanded (single-open accordion)
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    api.get('/tax/summary').then(({ data: r }) => { if (r.success) setData(r.data); })
      .catch(() => showToast('Failed to load tax summary', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Loading tax summary...</p>;
  if (!data) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>No tax data available.</p>;

  const toggle = (key) => setOpen((o) => (o === key ? '' : key));

  // A drill-down section: header row (label + headline figure) that expands to detail rows.
  const Section = ({ id, title, color, headline, rows }) => {
    const isOpen = open === id;
    return (
      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', borderLeft: `4px solid ${color}`, marginBottom: 14, overflow: 'hidden' }}>
        <div
          onClick={() => toggle(id)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isOpen ? <FiChevronDown size={18} color={color} /> : <FiChevronRight size={18} color="var(--text-muted)" />}
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          </div>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color }}>{formatCurrency(headline)}</span>
        </div>
        {isOpen && (
          <div style={{ padding: '4px 20px 18px', borderTop: '1px solid #F0F0F0' }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < rows.length - 1 ? '1px solid #F5F5F5' : 'none', fontSize: 14 }}>
                <span style={{ color: r.strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: r.strong ? 600 : 400 }}>{r.label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: r.strong ? 700 : 500, color: r.strong ? color : 'var(--text-primary)' }}>{formatCurrency(r.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {ToastComponent}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Tax</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Click a section to see the detail. Figures derive from posted invoices, approved bills, approved payroll, and account balances.</p>

      <div style={{ maxWidth: 720 }}>
        <Section id="vat" title="VAT / GST" color="#2563EB" headline={data.vat.net} rows={[
          { label: 'Output VAT (collected on sales)', value: data.vat.collected },
          { label: 'Input VAT (paid on purchases)', value: data.vat.paid },
          { label: 'Net VAT Payable to GRA', value: data.vat.net, strong: true },
          { label: 'VAT Payable account balance', value: data.vat.payable },
          { label: 'Input VAT Recoverable account', value: data.vat.inputVAT },
        ]} />

        <Section id="paye" title="PAYE (Employee Income Tax)" color="#DC2626" headline={data.paye.total} rows={[
          { label: 'Total PAYE deducted (approved payroll)', value: data.paye.total, strong: true },
          { label: 'PAYE Payable account balance', value: data.paye.payable },
          { label: 'Payroll runs processed', value: data.payrollRunCount },
        ]} />

        <Section id="ssnit" title="SSNIT Contributions" color="#16A34A" headline={data.ssnit.total} rows={[
          { label: 'Total SSNIT (employee + employer)', value: data.ssnit.total, strong: true },
          { label: 'Tier 1 payable', value: data.ssnit.tier1 },
          { label: 'Tier 2 payable', value: data.ssnit.tier2 },
          { label: 'Tier 3 / Provident Fund payable', value: data.ssnit.tier3 },
          { label: 'SSNIT Payable account balance', value: data.ssnit.payable },
        ]} />

        <Section id="wht" title="Withholding Tax" color="#B45309" headline={data.wht.payable} rows={[
          { label: 'WHT Payable to GRA (withheld from suppliers)', value: data.wht.payable, strong: true },
          { label: 'WHT Receivable (credits recoverable)', value: data.wht.receivable },
        ]} />

        <Section id="corp" title="Corporate Income Tax" color="#7C3AED" headline={data.corporateTax.payable} rows={[
          { label: 'Corporate Tax Payable', value: data.corporateTax.payable, strong: true },
          { label: 'Corporate Tax Expense (period charge)', value: data.corporateTax.expense },
        ]} />
      </div>

      <div style={{ marginTop: 20, maxWidth: 720, padding: '16px 20px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
        These figures are indicative and derived from your posted records. Always consult a licensed accountant or tax practitioner for official GRA filings and returns.
      </div>
    </div>
  );
}