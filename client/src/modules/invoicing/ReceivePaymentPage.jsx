// client/src/modules/invoicing/ReceivePaymentPage.jsx
//
// Receive one payment and APPLY IT ACROSS several invoices.
//
// The old screen settled exactly one invoice. In practice a customer pays a
// round amount that clears two invoices and part of a third, and the clerk had
// to split that into three separate receipts — which also produced three journal
// entries for one real movement of money. Now it is one receipt, one journal,
// and an allocation line per invoice.
//
// Rules the server enforces, mirrored here so the user finds out before saving:
//   • the applied amounts must add up to the payment exactly (no overpayment);
//   • no line may exceed that invoice's outstanding balance;
//   • every invoice must belong to the same customer and the same branch.
// "Auto-apply" fills the lines oldest-invoice-first, which is how a clerk
// allocates by hand and what an accountant expects by default.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDollarSign, FiZap, FiX } from 'react-icons/fi';
import invoiceService from '../../services/invoiceService';
import paymentService from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function ReceivePaymentPage() {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer: '', amount: '', date: new Date().toISOString().split('T')[0],
    method: 'bank_transfer', reference: '', notes: '',
  });
  // invoiceId -> amount being applied (string, so the field can be cleared)
  const [applied, setApplied] = useState({});

  useEffect(() => {
    invoiceService.getAll().then((r) => {
      if (r.success) setInvoices(r.data.filter((inv) => ['sent', 'partially_paid', 'overdue'].includes(inv.status)));
    }).catch(() => {});
  }, []);

  // Customers that actually have something outstanding.
  const customers = useMemo(() => {
    const seen = new Map();
    invoices.forEach((inv) => {
      const c = inv.customer;
      if (c && c._id && !seen.has(c._id)) seen.set(c._id, c);
    });
    return [...seen.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [invoices]);

  // Open invoices for the chosen customer, oldest first — the order a clerk
  // settles them in, and the order Auto-apply uses.
  const openInvoices = useMemo(() => {
    if (!form.customer) return [];
    return invoices
      .filter((inv) => String(inv.customer?._id) === String(form.customer) && inv.balance > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [invoices, form.customer]);

  const payAmount = r2(form.amount);
  const totalApplied = r2(Object.values(applied).reduce((s, v) => s + (Number(v) || 0), 0));
  const difference = r2(payAmount - totalApplied);
  const balanced = payAmount > 0 && difference === 0;

  // Branches present in the selected lines — the server refuses a receipt that
  // spans branches, so warn before the user gets that far.
  const branchesInUse = useMemo(() => {
    const ids = openInvoices
      .filter((inv) => Number(applied[inv._id]) > 0)
      .map((inv) => (inv.branch ? String(inv.branch?._id || inv.branch) : 'none'));
    return [...new Set(ids)];
  }, [applied, openInvoices]);

  const changeCustomer = (id) => { setForm((f) => ({ ...f, customer: id })); setApplied({}); };

  const setLine = (id, value) => setApplied((p) => ({ ...p, [id]: value }));

  const clearLines = () => setApplied({});

  // Fill the lines oldest-first until the payment is used up.
  const autoApply = () => {
    if (!(payAmount > 0)) { showToast('Enter the amount received first.', 'error'); return; }
    let left = payAmount;
    const next = {};
    for (const inv of openInvoices) {
      if (left <= 0) break;
      const take = r2(Math.min(left, inv.balance));
      if (take > 0) { next[inv._id] = String(take); left = r2(left - take); }
    }
    setApplied(next);
    if (left > 0) {
      showToast(`Applied ${formatCurrency(r2(payAmount - left))}. ${formatCurrency(left)} is more than this customer owes.`, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer) { showToast('Choose a customer', 'error'); return; }
    if (!form.date) { showToast('Date is required', 'error'); return; }

    const allocations = openInvoices
      .filter((inv) => Number(applied[inv._id]) > 0)
      .map((inv) => ({ invoice: inv._id, amount: r2(applied[inv._id]) }));

    if (allocations.length === 0) { showToast('Apply the payment to at least one invoice', 'error'); return; }
    const over = openInvoices.find((inv) => Number(applied[inv._id]) > inv.balance + 0.0001);
    if (over) { showToast(`${over.invoiceNumber}: applied more than its balance`, 'error'); return; }
    if (!balanced) {
      showToast(`Applied ${formatCurrency(totalApplied)} of ${formatCurrency(payAmount)} — the difference must be zero.`, 'error');
      return;
    }
    if (branchesInUse.length > 1) {
      showToast('Those invoices are from different branches. Record one receipt per branch.', 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await paymentService.receive({
        allocations,
        amount: payAmount,
        date: form.date, method: form.method,
        reference: form.reference, notes: form.notes,
      });
      if (res.success) { showToast(res.message); navigate('/invoicing/invoices'); }
      else showToast(res.message || 'Payment failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Payment failed', 'error'); }
    finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };
  const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff' };
  const td = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' };

  return (
    <div>
      {ToastComponent}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Receive Payment</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        One payment can settle several invoices. Apply it across the lines below — the applied amounts must add up to the amount received.
      </p>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 28, maxWidth: 940 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px,100%), 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Customer *</label>
              <select value={form.customer} onChange={(e) => changeCustomer(e.target.value)} style={inputStyle}>
                <option value="">Select customer...</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount received (GHS) *</label>
              <input type="number" step="0.01" min="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00" style={{ ...inputStyle, fontFamily: 'monospace' }} required />
            </div>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Method</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={inputStyle}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          {form.customer && openInvoices.length === 0 && (
            <div style={{ padding: '14px 16px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              This customer has no outstanding invoices.
            </div>
          )}

          {openInvoices.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Apply to invoices
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={autoApply}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--tech-blue)', color: 'var(--tech-blue)', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <FiZap size={13} /> Auto-apply (oldest first)
                  </button>
                  <button type="button" onClick={clearLines}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', color: 'var(--text-secondary)', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    <FiX size={13} /> Clear
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--deep-navy)' }}>
                      <th style={th}>Invoice #</th>
                      <th style={th}>Date</th>
                      <th style={th}>Due</th>
                      <th style={{ ...th, textAlign: 'right' }}>Total</th>
                      <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                      <th style={{ ...th, textAlign: 'right', width: 150 }}>Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInvoices.map((inv) => {
                      const val = applied[inv._id] || '';
                      const tooMuch = Number(val) > inv.balance + 0.0001;
                      return (
                        <tr key={inv._id} style={{ background: Number(val) > 0 ? '#F0FFF4' : '#fff' }}>
                          <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                          <td style={td}>{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                          <td style={{ ...td, color: new Date(inv.dueDate) < new Date() ? 'var(--danger)' : 'inherit' }}>
                            {new Date(inv.dueDate).toLocaleDateString('en-GB')}
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(inv.total)}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--warning)' }}>{formatCurrency(inv.balance)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <input type="number" step="0.01" min="0" max={inv.balance}
                              value={val}
                              onChange={(e) => setLine(inv._id, e.target.value)}
                              placeholder="0.00"
                              style={{
                                width: '100%', padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace',
                                border: `1px solid ${tooMuch ? 'var(--danger)' : 'var(--border)'}`,
                                borderRadius: 6, fontSize: 13, outline: 'none',
                              }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Running allocation status — the thing the clerk watches. */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                padding: '12px 18px', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13, fontWeight: 600,
                background: balanced ? '#D1FAE5' : '#FEF3C7',
                color: balanced ? '#065F46' : '#92400E',
              }}>
                <span>
                  Received {formatCurrency(payAmount)} · Applied {formatCurrency(totalApplied)}
                </span>
                <span style={{ fontFamily: 'monospace' }}>
                  {balanced ? '✓ Fully applied' : `Unapplied: ${formatCurrency(difference)}`}
                </span>
              </div>

              {branchesInUse.length > 1 && (
                <div style={{ padding: '11px 16px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
                  These invoices belong to different branches. A payment posts to one branch — record a separate receipt for each branch.
                </div>
              )}
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%), 1fr))', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Reference</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Cheque #, transfer ref..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => navigate('/invoicing/invoices')}
              style={{ padding: '11px 24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !balanced}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px',
                borderRadius: 'var(--radius-sm)',
                background: (saving || !balanced) ? 'var(--border)' : 'var(--success)',
                color: (saving || !balanced) ? 'var(--text-muted)' : '#fff',
                fontSize: 14, fontWeight: 600, border: 'none',
                cursor: (saving || !balanced) ? 'not-allowed' : 'pointer',
              }}>
              <FiDollarSign size={15} /> {saving ? 'Processing...' : 'Receive Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}