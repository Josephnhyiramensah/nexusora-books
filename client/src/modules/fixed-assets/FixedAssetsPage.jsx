import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTruck, FiSearch } from 'react-icons/fi';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import ResponsiveTable from '../../components/common/ResponsiveTable';

export default function FixedAssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const { showToast, ToastComponent } = useToast();

  const fetchAssets = async () => {
    try { setLoading(true); const { data } = await api.get('/fixed-assets'); if (data.success) setAssets(data.data); }
    catch { setAssets([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetchAssets(); }, []);

  const handleSave = async (formData) => {
    try {
      if (editing) { await api.put(`/fixed-assets/${editing._id}`, formData); showToast('Asset updated'); }
      else { await api.post('/fixed-assets', formData); showToast('Asset created'); }
      setModalOpen(false); setEditing(null); fetchAssets();
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleDepreciate = async (id) => {
    if (!window.confirm('Run monthly depreciation for this asset?')) return;
    try { const { data } = await api.post(`/fixed-assets/${id}/depreciate`); if (data.success) { showToast(data.message); fetchAssets(); } }
    catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const filtered = assets.filter((a) => a.description.toLowerCase().includes(search.toLowerCase()) || a.assetCode.includes(search));
  const totalNBV = assets.filter((a) => a.status === 'active').reduce((s, a) => s + (a.netBookValue || 0), 0);

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Fixed Assets</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{assets.length} assets — Net Book Value: {formatCurrency(totalNBV)}</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}><FiPlus size={16} /> New Asset</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 20, maxWidth: 360 }}>
        <FiSearch size={15} color="var(--text-muted)" />
        <input type="text" placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
  <ResponsiveTable minWidth={700}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>

          <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Cost</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Accum. Dep.</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>NBV</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr> :
            filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No assets. Click "New Asset" to register one.</td></tr> :
            filtered.map((a, i) => {
              const sc = getStatusColor(a.status);
              return (
                <tr key={a._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{a.assetCode}</td>
                  <td style={{ padding: '11px 16px' }}>{a.description}</td>
                  <td style={{ padding: '11px 16px', textTransform: 'capitalize' }}>{a.category}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(a.cost)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(a.accumulatedDepreciation)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(a.netBookValue)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{a.status}</span></td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {a.status === 'active' && <button onClick={() => handleDepreciate(a._id)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--warning)', fontSize: 11, fontWeight: 600, border: '1px solid var(--warning)' }}>Dep.</button>}
                      <button onClick={() => { setEditing(a); setModalOpen(true); }} style={{ padding: '4px 8px', color: 'var(--tech-blue)' }}><FiEdit2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
  </ResponsiveTable>
</div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Asset' : 'Register New Asset'} width={640}>
        <form onSubmit={(e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); handleSave(fd); }}>
          <div style={{ marginBottom: 16 }}><label style={labelStyle}>Description *</label><input name="description" style={inputStyle} defaultValue={editing?.description || ''} required placeholder="Office equipment, vehicle, etc." /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Category</label><select name="category" style={inputStyle} defaultValue={editing?.category || 'other'}><option value="equipment">Equipment</option><option value="furniture">Furniture</option><option value="vehicle">Vehicle</option><option value="property">Property</option><option value="other">Other</option></select></div>
            <div><label style={labelStyle}>Location</label><input name="location" style={inputStyle} defaultValue={editing?.location || ''} placeholder="Kumasi office" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Purchase Date *</label><input type="date" name="purchaseDate" style={inputStyle} defaultValue={editing?.purchaseDate ? new Date(editing.purchaseDate).toISOString().split('T')[0] : ''} required /></div>
            <div><label style={labelStyle}>Cost (GHS) *</label><input type="number" step="0.01" name="cost" style={inputStyle} defaultValue={editing?.cost || ''} required disabled={!!editing} /></div>
            <div><label style={labelStyle}>Residual Value</label><input type="number" step="0.01" name="residualValue" style={inputStyle} defaultValue={editing?.residualValue || 0} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div><label style={labelStyle}>Useful Life (Years) *</label><input type="number" name="usefulLifeYears" style={inputStyle} defaultValue={editing?.usefulLifeYears || ''} required min="1" /></div>
            <div><label style={labelStyle}>Depreciation Method</label><select name="depreciationMethod" style={inputStyle} defaultValue={editing?.depreciationMethod || 'straight_line'}><option value="straight_line">Straight Line</option><option value="declining_balance">Declining Balance</option></select></div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setModalOpen(false); setEditing(null); }} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>{editing ? 'Update' : 'Register'} Asset</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}