import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiSearch } from 'react-icons/fi';
import vendorService from '../../services/vendorService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';

import ResponsiveTable from '../../components/common/ResponsiveTable';

function VendorForm({ vendor, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: vendor?.name || '', email: vendor?.email || '',
    phone: vendor?.phone || '', address: vendor?.address || '',
    taxId: vendor?.taxId || '',
  });
  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };
  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text-primary)', outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Vendor Name *</label>
        <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name" required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Address</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Tax ID (TIN)</label>
        <input style={inputStyle} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
        <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>{vendor ? 'Update' : 'Create'} Vendor</button>
      </div>
    </form>
  );
}

export default function VendorListPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const fetchV = async () => {
    try { setLoading(true); const r = await vendorService.getAll(); if (r.success) setVendors(r.data); }
    catch { showToast('Failed to fetch vendors', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchV(); }, []);

  const handleSave = async (data) => {
    try {
      if (editing) { await vendorService.update(editing._id, data); showToast('Vendor updated'); }
      else { await vendorService.create(data); showToast('Vendor created'); }
      setModalOpen(false); setEditing(null); fetchV();
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
  };

  const filtered = vendors.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Vendors</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{vendors.length} vendors</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}><FiPlus size={16} /> New Vendor</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 20, maxWidth: 360 }}>
        <FiSearch size={15} color="var(--text-muted)" />
        <input type="text" placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
              <ResponsiveTable minWidth={700}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  
          <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Outstanding</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No vendors.</td></tr>
            : filtered.map((v, i) => (
              <tr key={v._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                <td style={{ padding: '11px 16px', fontWeight: 500 }}>{v.name}</td>
                <td style={{ padding: '11px 16px' }}>{v.email || '—'}</td>
                <td style={{ padding: '11px 16px' }}>{v.phone || '—'}</td>
                <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500, color: v.outstandingBalance > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatCurrency(v.outstandingBalance)}</td>
                <td style={{ padding: '11px 16px', textAlign: 'center' }}><button onClick={() => { setEditing(v); setModalOpen(true); }} style={{ padding: '5px 10px', color: 'var(--tech-blue)' }}><FiEdit2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
       </table>
  </ResponsiveTable>
</div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Vendor' : 'New Vendor'}>
        <VendorForm vendor={editing} onSave={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}