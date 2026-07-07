import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDollarSign } from 'react-icons/fi';
import invoiceService from '../../services/invoiceService';
import paymentService from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';

export default function ReceivePaymentPage() {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    invoiceId: '', amount: '', date: new Date().toISOString().split('T')[0],
    method: 'bank_transfer', reference: '', notes: '',
  });

  useEffect(() => {
    invoiceService.getAll().then((r) => {
      if (r.success) setInvoices(r.data.filter((inv) => ['sent', 'partially_paid'].includes(inv.status)));
    }).catch(() => {});
  }, []);

  const selectedInvoice = invoices.find((i) => i._id === form.invoiceId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoiceId || !form.amount || !form.date) { showToast('Invoice, amount, and date required', 'error'); return; }

    try {
      setSaving(true);
      const res = await paymentService.receive({
        invoiceId: form.invoiceId, amount: parseFloat(form.amount),
        date: form.date, method: form.method, reference: form.reference, notes: form.notes,
      });
      if (res.success) { showToast(res.message); navigate('/invoicing/invoices'); }
    } catch (err) { showToast(err.response?.data?.message || 'Payment failed', 'error'); }
    finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' };

  return (
    <div>
      {ToastComponent}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>Receive Payment</h1>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 28, maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Invoice *</label>
            <select value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} style={inputStyle}>
              <option value="">Select invoice...</option>
              {invoices.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.invoiceNumber} — {inv.customer?.name} — Balance: {formatCurrency(inv.balance)}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice && (
            <div style={{ padding: '12px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
              <div>Total: <strong>{formatCurrency(selectedInvoice.total)}</strong> | Paid: <strong>{formatCurrency(selectedInvoice.amountPaid)}</strong> | Balance: <strong style={{ color: 'var(--warning)' }}>{formatCurrency(selectedInvoice.balance)}</strong></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Amount (GHS) *</label>
              <input type="number" step="0.01" min="0.01" value={form.amount}
                max={selectedInvoice?.balance}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" style={{ ...inputStyle, fontFamily: 'monospace' }} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Payment Method</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={inputStyle}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Reference</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Cheque #, Transfer ref..." style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => navigate('/invoicing/invoices')} style={{ padding: '11px 24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 'var(--radius-sm)', background: 'var(--success)', color: '#fff', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              <FiDollarSign size={15} /> {saving ? 'Processing...' : 'Receive Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}