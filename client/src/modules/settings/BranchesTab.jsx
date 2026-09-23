import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiToggleLeft, FiToggleRight, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

// Matches the Settings design system (card / input / label / gold button, status
// pills like the Users tab). Branch management: list, add, edit, activate/
// deactivate, delete. The Head Office branch is protected — it can't be
// deactivated or deleted (it's the anchor every record points to).
const card = { background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' };
const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };
const th = { padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' };
const td = { padding: '11px 16px' };

const EMPTY = { name: '', code: '', address: '', city: '', region: '', phone: '', email: '' };

export default function BranchesTab() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);      // branch being edited, or null for create
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/branches');
      if (data.success) setBranches(data.data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load branches', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchBranches(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (b) => {
    setEditing(b);
    setForm({ name: b.name || '', code: b.code || '', address: b.address || '', city: b.city || '', region: b.region || '', phone: b.phone || '', email: b.email || '' });
    setModalOpen(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) { showToast('Name and code are required.', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/branches/${editing._id}`, form);
        if (data.success) showToast('Branch updated.');
      } else {
        const { data } = await api.post('/branches', form);
        if (data.success) showToast(data.message || 'Branch created.');
      }
      setModalOpen(false);
      setEditing(null);
      fetchBranches();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save branch.', 'error');
    } finally { setSaving(false); }
  };

  const toggleStatus = async (b) => {
    try {
      const { data } = await api.patch(`/branches/${b._id}/status`, { isActive: !b.isActive });
      if (data.success) { showToast(data.message); fetchBranches(); }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete branch "${b.name}"? This only works if it has no records. Otherwise deactivate it instead.`)) return;
    try {
      const { data } = await api.delete(`/branches/${b._id}`);
      if (data.success) { showToast(data.message); fetchBranches(); }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete branch.', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 560 }}>
          Branches let one company keep separate books per location while the head office sees everything.
          Every record belongs to a branch; the Head Office branch is the company default and can't be removed.
        </p>
        {isAdmin && (
          <button onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', flexShrink: 0 }}>
            <FiPlus size={14} /> Add Branch
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: 20 }}>Loading branches…</p>
      ) : branches.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', padding: 20 }}>No branches yet.</p>
      ) : (
        <div style={{ ...card, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={th}>Branch</th>
                <th style={th}>Code</th>
                <th style={th}>Location</th>
                <th style={{ ...th, textAlign: 'center' }}>Status</th>
                <th style={{ ...th, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b, i) => (
                <tr key={b._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ ...td, fontWeight: 500 }}>
                    {b.name}
                    {b.isHeadOffice && (
                      <span title="Company default branch"
                        style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#B8860B', padding: '3px 8px', background: '#FEF9E7', borderRadius: 12 }}>
                        ★ Head Office
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{b.code}</td>
                  <td style={td}>{[b.city, b.region].filter(Boolean).join(', ') || '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: b.isActive ? '#D1FAE5' : '#FEE2E2', color: b.isActive ? '#065F46' : '#991B1B' }}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                      {isAdmin && (
                        <button onClick={() => openEdit(b)} title="Edit"
                          style={{ padding: '4px 8px', color: 'var(--tech-blue)', cursor: 'pointer', background: 'none', border: 'none' }}>
                          <FiEdit2 size={13} />
                        </button>
                      )}
                      {isAdmin && !b.isHeadOffice && (
                        <button onClick={() => toggleStatus(b)} title={b.isActive ? 'Deactivate' : 'Activate'}
                          style={{ padding: '4px 8px', color: b.isActive ? 'var(--danger)' : 'var(--success)', cursor: 'pointer', background: 'none', border: 'none' }}>
                          {b.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                        </button>
                      )}
                      {isAdmin && !b.isHeadOffice && (
                        <button onClick={() => remove(b)} title="Delete (empty branches only)"
                          style={{ padding: '4px 8px', color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}>
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Branch' : 'Add Branch'}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Branch Name *</label>
              <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Accra Branch" required />
            </div>
            <div>
              <label style={labelStyle}>Code *</label>
              <input style={inputStyle} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="ACC" maxLength={8} required />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Accra" />
            </div>
            <div>
              <label style={labelStyle}>Region</label>
              <input style={inputStyle} value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="Greater Accra" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          {editing?.isHeadOffice && (
            <div style={{ padding: '12px 16px', background: '#FEF9E7', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: '#92400E' }}>
              This is the Head Office branch — you can edit its details, but it can't be deactivated or deleted.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setModalOpen(false); setEditing(null); }}
              style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : (editing ? 'Update Branch' : 'Create Branch')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}