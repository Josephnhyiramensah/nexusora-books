import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiSearch, FiDownload, FiUpload, FiSliders } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import ResponsiveTable from '../../components/common/ResponsiveTable';

const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };
const th = { padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' };
const thR = { ...th, textAlign: 'right' };
const thC = { ...th, textAlign: 'center' };

// Item catalogue form. Stock quantity is NOT editable here — stock only changes
// through movements (receive / issue / adjust / transfer). On CREATE we allow an
// opening quantity, which is recorded as an opening_balance movement.
function ItemForm({ item, onSave, onCancel }) {
  const isNew = !item;
  const [form, setForm] = useState({
    code: item?.code || '', name: item?.name || '', description: item?.description || '',
    category: item?.category || '', unitCost: item?.unitCost || 0,
    sellingPrice: item?.sellingPrice || 0, reorderLevel: item?.reorderLevel || 0,
    openingQuantity: 0,
  });
  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div><label style={labelStyle}>Item Code *</label><input style={inputStyle} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="SKU-001" /></div>
        <div><label style={labelStyle}>Item Name *</label><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Product name" /></div>
      </div>
      <div style={{ marginBottom: 16 }}><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div><label style={labelStyle}>Category</label><input style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Raw materials" /></div>
        <div><label style={labelStyle}>Unit Cost (GHS)</label><input type="number" step="0.01" style={inputStyle} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
        <div><label style={labelStyle}>Selling Price (GHS)</label><input type="number" step="0.01" style={inputStyle} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div><label style={labelStyle}>Reorder Level</label><input type="number" style={inputStyle} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
        {isNew && (
          <div>
            <label style={labelStyle}>Opening Quantity</label>
            <input type="number" step="0.01" style={inputStyle} value={form.openingQuantity} onChange={(e) => setForm({ ...form, openingQuantity: e.target.value })} placeholder="0" />
          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.55 }}>
        {isNew
          ? 'Opening quantity is recorded as an opening-balance movement at your current branch. After this, stock changes only through Receive, Issue, Adjust or Transfer — so every change keeps an audit trail.'
          : 'Stock quantity is not edited here. Use Receive, Issue, Adjust or Transfer so every change is recorded with a date, branch and reason.'}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>Cancel</button>
        <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>{item ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

// Receive / Issue / Adjust in one small form — the action decides the endpoint.
function MovementForm({ item, action, onDone, onCancel, showToast }) {
  const [form, setForm] = useState({ quantity: '', unitCost: item?.unitCost || 0, reference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const titles = {
    receive: { verb: 'Receive', help: 'Stock coming in — increases this branch\u2019s quantity. The unit cost feeds the weighted average.' },
    issue:   { verb: 'Issue',   help: 'Stock going out (used or written off) — decreases this branch\u2019s quantity at the current average cost.' },
    adjust:  { verb: 'Adjust',  help: 'A correction after a physical count. Enter a positive number to add, or a negative number to remove.' },
  };
  const t = titles[action];

  const submit = async (e) => {
    e.preventDefault();
    const qty = Number(form.quantity);
    if (!qty) { showToast('Enter a quantity.', 'error'); return; }
    setSaving(true);
    try {
      const body = { item: item._id, quantity: qty, reference: form.reference, notes: form.notes };
      if (action === 'receive') body.unitCost = Number(form.unitCost) || 0;
      const { data } = await api.post(`/inventory/${action}`, body);
      if (data.success) { showToast(data.message || 'Recorded.'); onDone(); }
      else showToast(data.message || 'Failed', 'error');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record.', 'error');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.55 }}>{t.help}</p>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Item</label>
        <input style={{ ...inputStyle, background: 'var(--bg-app)' }} value={`${item.code} — ${item.name}`} disabled />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: action === 'receive' ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Quantity *</label>
          <input type="number" step="0.01" style={inputStyle} value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder={action === 'adjust' ? 'e.g. -3 to remove 3' : '0'} required />
        </div>
        {action === 'receive' && (
          <div>
            <label style={labelStyle}>Unit Cost (GHS)</label>
            <input type="number" step="0.01" style={inputStyle} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
        <div><label style={labelStyle}>Reference</label><input style={inputStyle} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="GRN-001, count sheet…" /></div>
        <div><label style={labelStyle}>Notes</label><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Reason / detail" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>Cancel</button>
        <button type="submit" disabled={saving} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : `${t.verb} Stock`}
        </button>
      </div>
    </form>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [moveFor, setMoveFor] = useState(null);      // { item, action }
  const { showToast, ToastComponent } = useToast();

  const fetchItems = async () => {
    try { setLoading(true); const { data } = await api.get('/inventory'); if (data.success) setItems(data.data); }
    catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSave = async (formData) => {
    try {
      if (editing) {
        const { openingQuantity, ...rest } = formData;
        await api.put(`/inventory/${editing._id}`, rest);
        showToast('Item updated');
      } else {
        await api.post('/inventory', formData);
        showToast('Item created');
      }
      setModalOpen(false); setEditing(null); fetchItems();
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
  };

  const filtered = items.filter((i) =>
    i.code?.toLowerCase().includes(search.toLowerCase()) ||
    i.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Value uses derived on-hand × unit cost (an indicative figure; the Valuation
  // page shows the proper weighted-average valuation per branch).
  const totalValue = items.reduce((s, i) => s + ((i.onHand || 0) * (i.unitCost || 0)), 0);
  const scopeLabel = items[0]?.onHandScope === 'branch' ? 'this branch' : 'all branches';

  const actionBtn = (bg) => ({
    padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)',
    background: '#fff', color: bg, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
  });

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Inventory</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {items.length} items — showing stock for {scopeLabel} · indicative value {formatCurrency(totalValue)}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0 }}><FiPlus size={16} /> New Item</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 20, maxWidth: 360 }}>
        <FiSearch size={15} color="var(--text-muted)" />
        <input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }} />
      </div>

      <ResponsiveTable minWidth={820}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' }}>
          <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
            <th style={th}>Code</th>
            <th style={th}>Name</th>
            <th style={th}>Category</th>
            <th style={thR}>On Hand</th>
            <th style={thR}>Cost</th>
            <th style={thR}>Price</th>
            <th style={thC}>Stock Actions</th>
            <th style={thC}></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr> :
            filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No inventory items. Click "New Item" to add.</td></tr> :
            filtered.map((item, i) => {
              const onHand = item.onHand || 0;
              const lowStock = item.reorderLevel > 0 && onHand <= item.reorderLevel;
              const negative = onHand < 0;
              return (
                <tr key={item._id} style={{ borderBottom: '1px solid var(--border)', background: negative ? '#FEF2F2' : lowStock ? '#FFF7ED' : i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{item.code}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--text-muted)' }}>{item.category || '—'}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: negative ? 'var(--danger)' : lowStock ? '#B45309' : 'var(--text-primary)' }}>
                    {onHand}
                    {negative ? ' ⚠' : lowStock ? ' ↓' : ''}
                    {item.onHandByBranch && Object.keys(item.onHandByBranch).length > 1 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>across branches</div>
                    )}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.unitCost)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.sellingPrice)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => setMoveFor({ item, action: 'receive' })} style={actionBtn('var(--success, #16A34A)')}>Receive</button>
                      <button onClick={() => setMoveFor({ item, action: 'issue' })} style={actionBtn('var(--danger)')}>Issue</button>
                      <button onClick={() => setMoveFor({ item, action: 'adjust' })} style={actionBtn('var(--tech-blue)')}>Adjust</button>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                    <button onClick={() => { setEditing(item); setModalOpen(true); }} style={{ padding: '5px 10px', color: 'var(--tech-blue)', background: 'none', border: 'none', cursor: 'pointer' }}><FiEdit2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ResponsiveTable>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Item' : 'New Item'} width={640}>
        <ItemForm item={editing} onSave={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} />
      </Modal>

      <Modal isOpen={!!moveFor} onClose={() => setMoveFor(null)}
        title={moveFor ? `${moveFor.action === 'receive' ? 'Receive' : moveFor.action === 'issue' ? 'Issue' : 'Adjust'} Stock` : ''} width={600}>
        {moveFor && (
          <MovementForm item={moveFor.item} action={moveFor.action} showToast={showToast}
            onDone={() => { setMoveFor(null); fetchItems(); }}
            onCancel={() => setMoveFor(null)} />
        )}
      </Modal>
    </div>
  );
}