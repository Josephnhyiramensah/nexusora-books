import { useState, useEffect } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import { useToast } from '../../hooks/useToast';
import { useBranchField } from '../../components/branches/BranchSelect';
import api from '../../services/api';

// Move stock from one branch to another. Recorded as a linked pair of movements
// (out of the source, in to the destination) that reconcile to zero, carrying the
// source branch's average cost so value moves with the stock.
const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', background: '#fff' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

export default function StockTransferPage() {
  const [items, setItems] = useState([]);
  // Branches this user may WRITE to (mirrors the server rule). A branch-restricted
  // user only sees — and can only transfer between — branches they actually hold.
  const { options: branches } = useBranchField();
  const [form, setForm] = useState({ item: '', fromBranch: '', toBranch: '', quantity: '', reference: '', notes: '' });
  const [available, setAvailable] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast, ToastComponent } = useToast();

    useEffect(() => {
    api.get('/inventory').then(({ data }) => { if (data.success) setItems(data.data); }).catch(() => {});
  }, []);

  // Show what the source branch actually holds, so the user isn't guessing.
  useEffect(() => {
    if (!form.item || !form.fromBranch) { setAvailable(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/inventory/${form.item}/stock`);
        if (cancelled || !data.success) return;
        const byBranch = data.data.byBranch || {};
        const qty = data.data.scope === 'branch' ? data.data.onHand : (byBranch[form.fromBranch] ?? 0);
        setAvailable(qty);
      } catch { if (!cancelled) setAvailable(null); }
    })();
    return () => { cancelled = true; };
  }, [form.item, form.fromBranch]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.item || !form.fromBranch || !form.toBranch) { showToast('Choose an item and both branches.', 'error'); return; }
    if (form.fromBranch === form.toBranch) { showToast('Source and destination must be different branches.', 'error'); return; }
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) { showToast('Enter a quantity greater than zero.', 'error'); return; }

    setSaving(true); setResult(null);
    try {
      const { data } = await api.post('/inventory/transfer', {
        item: form.item, quantity: qty,
        fromBranch: form.fromBranch, toBranch: form.toBranch,
        reference: form.reference, notes: form.notes,
      });
      if (data.success) {
        setResult(data.data);
        showToast('Stock transferred.');
        setForm((f) => ({ ...f, quantity: '', reference: '', notes: '' }));
      } else showToast(data.message || 'Transfer failed', 'error');
    } catch (err) {
      showToast(err.response?.data?.message || 'Transfer failed', 'error');
    } finally { setSaving(false); }
  };

  const branchName = (id) => branches.find((b) => String(b._id) === String(id))?.name || id;

  return (
    <div>
      {ToastComponent}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Transfer Stock</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Move stock between branches. Both sides are recorded, so the total never changes — only where it sits.
        </p>
      </div>

      {branches.length < 2 ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 28, maxWidth: 680 }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            You need at least two active branches to transfer stock. Add another branch in Settings → Branches.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 28, maxWidth: 680 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Item *</label>
            <select style={inputStyle} value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required>
              <option value="">Select an item…</option>
              {items.map((i) => <option key={i._id} value={i._id}>{i.code} — {i.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'end', marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>From branch *</label>
              <select style={inputStyle} value={form.fromBranch} onChange={(e) => setForm({ ...form, fromBranch: e.target.value })} required>
                <option value="">Source…</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.code} — {b.name}</option>)}
              </select>
            </div>
            <div style={{ paddingBottom: 10, color: 'var(--text-muted)' }}><FiArrowRight size={18} /></div>
            <div>
              <label style={labelStyle}>To branch *</label>
              <select style={inputStyle} value={form.toBranch} onChange={(e) => setForm({ ...form, toBranch: e.target.value })} required>
                <option value="">Destination…</option>
                {branches.filter((b) => String(b._id) !== String(form.fromBranch)).map((b) => <option key={b._id} value={b._id}>{b.code} — {b.name}</option>)}
              </select>
            </div>
          </div>

          {available !== null && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
              Available at {branchName(form.fromBranch)}: <strong style={{ fontFamily: 'monospace' }}>{available}</strong>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Quantity *</label>
              <input type="number" step="0.01" min="0" style={inputStyle} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Reference</label>
              <input style={inputStyle} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Waybill / note no." />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Notes</label>
            <input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Reason for the transfer" />
          </div>

          <button type="submit" disabled={saving}
            style={{ padding: '11px 28px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Transferring…' : 'Transfer Stock'}
          </button>

          {result && (
            <div style={{ marginTop: 20, padding: '14px 18px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#065F46' }}>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>Transfer recorded ({result.transferId})</p>
              <p>{branchName(result.from?.branch)} now holds <strong>{result.from?.onHand}</strong> · {branchName(result.to?.branch)} now holds <strong>{result.to?.onHand}</strong></p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}