import { useState, useEffect } from 'react';
import { FiPlus, FiCheck } from 'react-icons/fi';
import { formatCurrency, getStatusColor } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import api from '../../services/api';

export default function BudgetPage() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const fetchBudgets = async () => {
    try { setLoading(true); const { data } = await api.get('/budgets'); if (data.success) setBudgets(data.data); }
    catch { setBudgets([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetchBudgets(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const { data } = await api.post('/budgets', { name: fd.name, fiscalYear: Number(fd.fiscalYear) });
      if (data.success) { showToast('Budget created'); setModalOpen(false); fetchBudgets(); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this budget?')) return;
    try { const { data } = await api.post(`/budgets/${id}/approve`); if (data.success) { showToast('Budget approved'); fetchBudgets(); } }
    catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Budgets</h1>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>
          <FiPlus size={16} /> New Budget
        </button>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> :
      budgets.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No budgets created yet. Click "New Budget" to start.</p> :
      <div style={{ display: 'grid', gap: 16 }}>
        {budgets.map((b) => {
          const sc = getStatusColor(b.status);
          return (
            <div key={b._id} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Fiscal Year: {b.fiscalYear} — {b.lines?.length || 0} line items</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, textTransform: 'capitalize' }}>{b.status}</span>
                  {b.status === 'draft' && <button onClick={() => handleApprove(b._id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: 12, fontWeight: 600, border: '1px solid var(--success)' }}><FiCheck size={12} /> Approve</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Budget" width={480}>
        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Budget Name *</label>
            <input name="name" style={inputStyle} required placeholder="e.g. FY 2026 Operating Budget" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Fiscal Year *</label>
            <input name="fiscalYear" type="number" style={inputStyle} required defaultValue={new Date().getFullYear()} min="2020" max="2030" />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>Create Budget</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}