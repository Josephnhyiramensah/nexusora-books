import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiSearch, FiPackage } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import ResponsiveTable from '../../components/common/ResponsiveTable';


function ItemForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: item?.code || '', name: item?.name || '', description: item?.description || '',
    category: item?.category || '', unitCost: item?.unitCost || 0,
    sellingPrice: item?.sellingPrice || 0, quantityOnHand: item?.quantityOnHand || 0,
    reorderLevel: item?.reorderLevel || 0,
  });
  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };
  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div><label style={labelStyle}>Quantity on Hand</label><input type="number" style={inputStyle} value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} /></div>
        <div><label style={labelStyle}>Reorder Level</label><input type="number" style={inputStyle} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
        <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>{item ? 'Update' : 'Create'}</button>
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
  const { showToast, ToastComponent } = useToast();

  const fetchItems = async () => {
    try { setLoading(true); const { data } = await api.get('/inventory'); if (data.success) setItems(data.data); }
    catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSave = async (formData) => {
    try {
      if (editing) { await api.put(`/inventory/${editing._id}`, formData); showToast('Item updated'); }
      else { await api.post('/inventory', formData); showToast('Item created'); }
      setModalOpen(false); setEditing(null); fetchItems();
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
  };

  const filtered = items.filter((i) =>
    i.code?.toLowerCase().includes(search.toLowerCase()) ||
    i.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = items.reduce((s, i) => s + ((i.quantityOnHand || 0) * (i.unitCost || 0)), 0);

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Inventory</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{items.length} items — Total value: {formatCurrency(totalValue)}</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}><FiPlus size={16} /> New Item</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 20, maxWidth: 360 }}>
        <FiSearch size={15} color="var(--text-muted)" />
        <input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
  <ResponsiveTable minWidth={700}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>

          <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Cost</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Price</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Value</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr> :
            filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No inventory items. Click "New Item" to add.</td></tr> :
            filtered.map((item, i) => {
              const value = (item.quantityOnHand || 0) * (item.unitCost || 0);
              const lowStock = item.quantityOnHand <= item.reorderLevel && item.reorderLevel > 0;
              return (
                <tr key={item._id} style={{ borderBottom: '1px solid var(--border)', background: lowStock ? '#FFF5F5' : i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{item.code}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--text-muted)' }}>{item.category || '—'}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: lowStock ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {item.quantityOnHand}{lowStock && ' ⚠'}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.unitCost)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.sellingPrice)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{formatCurrency(value)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}><button onClick={() => { setEditing(item); setModalOpen(true); }} style={{ padding: '5px 10px', color: 'var(--tech-blue)' }}><FiEdit2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
  </ResponsiveTable>
</div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Item' : 'New Item'} width={640}>
        <ItemForm item={editing} onSave={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}