import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSave, FiCheck } from 'react-icons/fi';
import vendorService from '../../services/vendorService';
import billService from '../../services/billService';
import accountService from '../../services/accountService';
import SmartAccountSelect from '../../components/common/SmartAccountSelect';
import { useToast } from '../../hooks/useToast';

const emptyLine = () => ({ description: '', quantity: 1, unitPrice: '', account: '' });

export default function BillFormPage() {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vendor: '', date: new Date().toISOString().split('T')[0],
    dueDate: '', taxRate: 0, notes: '', lines: [emptyLine()],
  });

  useEffect(() => {
    vendorService.getAll({ isActive: 'true' }).then((r) => { if (r.success) setVendors(r.data); }).catch(() => {});
    accountService.getAll({ isActive: 'true' }).then((r) => {
      if (r.success) setAccounts(r.data.filter((a) => ['expense', 'cogs', 'asset'].includes(a.type)));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.date && !form.dueDate) {
      const d = new Date(form.date); d.setDate(d.getDate() + 30);
      setForm((p) => ({ ...p, dueDate: d.toISOString().split('T')[0] }));
    }
  }, [form.date]);

  const subtotal = form.lines.reduce((s, l) => s + ((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0)), 0);
  const taxAmount = Math.round(subtotal * (parseFloat(form.taxRate) || 0) / 100 * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const updateLine = (i, f, v) => { const u = [...form.lines]; u[i] = { ...u[i], [f]: v }; setForm({ ...form, lines: u }); };
  const addLine = () => setForm({ ...form, lines: [...form.lines, emptyLine()] });
  const removeLine = (i) => { if (form.lines.length <= 1) return; setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) }); };

  const handleSave = async (approveAfter = false) => {
    if (!form.vendor) { showToast('Select a vendor', 'error'); return; }
    if (!form.date || !form.dueDate) { showToast('Date and due date required', 'error'); return; }
    const validLines = form.lines.filter((l) => l.description && parseFloat(l.unitPrice) > 0);
    if (validLines.length < 1) { showToast('At least 1 line required', 'error'); return; }

    try {
      setSaving(true);
      const res = await billService.create({
        vendor: form.vendor, date: form.date, dueDate: form.dueDate,
        taxRate: parseFloat(form.taxRate) || 0, notes: form.notes,
        lines: validLines.map((l) => ({ description: l.description, quantity: parseFloat(l.quantity) || 1, unitPrice: parseFloat(l.unitPrice), account: l.account || undefined })),
      });
      if (res.success) {
        if (approveAfter) {
          const aRes = await billService.approve(res.data._id);
          if (aRes.success) showToast(`${res.data.billNumber} created and approved!`);
        } else { showToast(`${res.data.billNumber} created as draft`); }
        navigate('/bills/list');
      }
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' };

  return (
    <div>
      {ToastComponent}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>New Bill</h1>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 28 }}>
        {/* 👇 CHANGED: grid columns to responsive auto-fit with min 220px */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Vendor *</label>
            <select value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} style={inputStyle}>
              <option value="">Select vendor...</option>
              {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Bill Date *</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Due Date *</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Tax Rate (%)</label>
            <input type="number" step="0.01" min="0" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} style={inputStyle} />
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--deep-navy)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '5%' }}>#</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '30%' }}>Description</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '25%' }}>Expense Account</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '12%' }}>Qty</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '15%' }}>Unit Price</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '13%' }}>Amount</th>
            </tr></thead>
            <tbody>
              {form.lines.map((line, i) => {
                const amt = Math.round((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0) * 100) / 100;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '6px 8px' }}><input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Item or service..." style={{ ...inputStyle, fontSize: 12, padding: '8px 12px' }} /></td>
                    <td style={{ padding: '6px 8px' }}><SmartAccountSelect accounts={accounts} value={line.account} onChange={(id) => updateLine(i, 'account', id)} placeholder="Expense account..." /></td>
                    <td style={{ padding: '6px 8px' }}><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '8px 12px', textAlign: 'right' }} /></td>
                    <td style={{ padding: '6px 8px' }}><input type="number" step="0.01" min="0" value={line.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} placeholder="0.00" style={{ ...inputStyle, fontSize: 12, padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }} /></td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                      {amt.toFixed(2)}
                      {form.lines.length > 1 && <button onClick={() => removeLine(i)} style={{ marginLeft: 8, color: 'var(--danger)', padding: 2 }}><FiTrash2 size={13} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--tech-blue)', color: 'var(--tech-blue)', fontSize: 12, fontWeight: 600, background: '#fff', marginBottom: 20 }}><FiPlus size={14} /> Add Line</button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}><span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{subtotal.toFixed(2)}</span></div>
            {taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}><span style={{ color: 'var(--text-secondary)' }}>Tax ({form.taxRate}%)</span><span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{taxAmount.toFixed(2)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, borderTop: '2px solid var(--deep-navy)', marginTop: 4 }}><span style={{ fontWeight: 700 }}>Total (GHS)</span><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{total.toFixed(2)}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={() => navigate('/bills/list')} style={{ padding: '11px 24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 'var(--radius-sm)', background: 'var(--tech-blue)', color: '#fff', fontSize: 14, fontWeight: 600 }}><FiSave size={15} /> Save as Draft</button>
          <button onClick={() => handleSave(true)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}><FiCheck size={15} /> Save & Approve</button>
        </div>
      </div>
    </div>
  );
}