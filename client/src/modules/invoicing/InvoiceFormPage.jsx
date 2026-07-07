import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSave, FiSend } from 'react-icons/fi';
import customerService from '../../services/customerService';
import invoiceService from '../../services/invoiceService';
import accountService from '../../services/accountService';
import SmartAccountSelect from '../../components/common/SmartAccountSelect';
import { useToast } from '../../hooks/useToast';
// 👇 ADDED: ResponsiveTable import for wrapping the line-items table
import ResponsiveTable from '../../components/common/ResponsiveTable';

const emptyLine = () => ({ description: '', quantity: 1, unitPrice: '', account: '' });

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer: '', date: new Date().toISOString().split('T')[0],
    dueDate: '', taxRate: 0, notes: '',
    lines: [emptyLine()],
  });

  useEffect(() => {
    customerService.getAll({ isActive: 'true' }).then((r) => { if (r.success) setCustomers(r.data); }).catch(() => {});
    accountService.getAll({ isActive: 'true' }).then((r) => {
      if (r.success) setAccounts(r.data.filter((a) => a.type === 'revenue'));
    }).catch(() => {});
  }, []);

  // Auto-set due date 30 days from invoice date
  useEffect(() => {
    if (form.date && !form.dueDate) {
      const d = new Date(form.date);
      d.setDate(d.getDate() + 30);
      setForm((prev) => ({ ...prev, dueDate: d.toISOString().split('T')[0] }));
    }
  }, [form.date]);

  const subtotal = form.lines.reduce((sum, l) => sum + ((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0)), 0);
  const taxAmount = Math.round(subtotal * (parseFloat(form.taxRate) || 0) / 100 * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const updateLine = (i, field, value) => {
    const updated = [...form.lines];
    updated[i] = { ...updated[i], [field]: value };
    setForm({ ...form, lines: updated });
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, emptyLine()] });
  const removeLine = (i) => {
    if (form.lines.length <= 1) return;
    setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });
  };

  const handleSave = async (sendAfter = false) => {
    if (!form.customer) { showToast('Select a customer', 'error'); return; }
    if (!form.date || !form.dueDate) { showToast('Date and due date are required', 'error'); return; }
    const validLines = form.lines.filter((l) => l.description && parseFloat(l.unitPrice) > 0);
    if (validLines.length < 1) { showToast('At least 1 line with description and price required', 'error'); return; }

    try {
      setSaving(true);
      const res = await invoiceService.create({
        customer: form.customer, date: form.date, dueDate: form.dueDate,
        taxRate: parseFloat(form.taxRate) || 0, notes: form.notes,
        lines: validLines.map((l) => ({
          description: l.description, quantity: parseFloat(l.quantity) || 1,
          unitPrice: parseFloat(l.unitPrice), account: l.account || undefined,
        })),
      });

      if (res.success) {
        if (sendAfter) {
          const sendRes = await invoiceService.send(res.data._id);
          if (sendRes.success) showToast(`${res.data.invoiceNumber} created and sent!`);
        } else {
          showToast(`${res.data.invoiceNumber} created as draft`);
        }
        navigate('/invoicing/invoices');
      }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to create invoice', 'error'); }
    finally { setSaving(false); }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)', outline: 'none',
  };

  return (
    <div>
      {ToastComponent}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>New Invoice</h1>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 28 }}>
        {/* 👇 CHANGED: Header grid – replaced '1fr 1fr 1fr 1fr' with auto‑collapsing responsive columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Customer *</label>
            <select value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} style={inputStyle}>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Invoice Date *</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Due Date *</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Tax Rate (%)</label>
            <input type="number" step="0.01" min="0" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} style={inputStyle} placeholder="e.g. 15" />
          </div>
        </div>

        {/* Line Items – 👇 CHANGED: outer div now only holds background/border-radius, no overflow:hidden */}
        <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          {/* 👇 ADDED: ResponsiveTable wrapper */}
          <ResponsiveTable minWidth={600}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--deep-navy)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '5%' }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '30%' }}>Description</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '25%' }}>Revenue Account</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '12%' }}>Qty</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '15%' }}>Unit Price</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '13%' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, i) => {
                  const lineAmount = Math.round((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0) * 100) / 100;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                          placeholder="Product or service..." style={{ ...inputStyle, fontSize: 12, padding: '8px 12px' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <SmartAccountSelect accounts={accounts} value={line.account}
                          onChange={(id) => updateLine(i, 'account', id)} placeholder="Revenue account..." />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" min="1" step="1" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                          style={{ ...inputStyle, fontSize: 12, padding: '8px 12px', textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" step="0.01" min="0" value={line.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                          placeholder="0.00" style={{ ...inputStyle, fontSize: 12, padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }} />
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                        {lineAmount.toFixed(2)}
                        {form.lines.length > 1 && (
                          <button onClick={() => removeLine(i)} style={{ marginLeft: 8, color: 'var(--danger)', padding: 2 }}><FiTrash2 size={13} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          {/* 👇 ADDED: closing ResponsiveTable */}
          </ResponsiveTable>
        </div>

        <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--tech-blue)', color: 'var(--tech-blue)', fontSize: 12, fontWeight: 600, background: '#fff', marginBottom: 20 }}>
          <FiPlus size={14} /> Add Line
        </button>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{subtotal.toFixed(2)}</span>
            </div>
            {taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tax ({form.taxRate}%)</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, borderTop: '2px solid var(--deep-navy)', marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total (GHS)</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--deep-navy)' }}>{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Payment terms, delivery notes..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={() => navigate('/invoicing/invoices')} style={{ padding: '11px 24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 'var(--radius-sm)', background: 'var(--tech-blue)', color: '#fff', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            <FiSave size={15} /> Save as Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            <FiSend size={15} /> Save & Send
          </button>
        </div>
      </div>
    </div>
  );
}