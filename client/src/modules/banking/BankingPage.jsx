import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiCreditCard } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import api from '../../services/api';

export default function BankingPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const fetchAccounts = async () => {
    try { setLoading(true); const { data } = await api.get('/bank-accounts'); if (data.success) setAccounts(data.data); }
    catch { setAccounts([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetchAccounts(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      if (editing) { await api.put(`/bank-accounts/${editing._id}`, fd); showToast('Account updated'); }
      else { await api.post('/bank-accounts', fd); showToast('Account created'); }
      setModalOpen(false); setEditing(null); fetchAccounts();
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Bank Accounts</h1>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}><FiPlus size={16} /> New Account</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> :
        accounts.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No bank accounts. Add one to track your finances.</p> :
        accounts.map((acct) => (
          <div key={acct._id} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 24, borderLeft: '4px solid var(--tech-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{acct.accountName}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{acct.bankName}</p>
              </div>
              <button onClick={() => { setEditing(acct); setModalOpen(true); }} style={{ padding: 6, color: 'var(--tech-blue)' }}><FiEdit2 size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Account #:</span><br /><strong>{acct.accountNumber || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Type:</span><br /><strong style={{ textTransform: 'capitalize' }}>{acct.accountType?.replace('_', ' ')}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Currency:</span><br /><strong>{acct.currency}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Balance:</span><br /><strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{formatCurrency(acct.currentBalance)}</strong></div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Bank Account' : 'New Bank Account'}>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}><label style={labelStyle}>Account Name *</label><input name="accountName" style={inputStyle} defaultValue={editing?.accountName || ''} required placeholder="GCB Main Account" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Bank Name *</label><input name="bankName" style={inputStyle} defaultValue={editing?.bankName || ''} required placeholder="GCB Bank" /></div>
            <div><label style={labelStyle}>Account Number</label><input name="accountNumber" style={inputStyle} defaultValue={editing?.accountNumber || ''} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div><label style={labelStyle}>Account Type</label><select name="accountType" style={inputStyle} defaultValue={editing?.accountType || 'checking'}><option value="checking">Checking</option><option value="savings">Savings</option><option value="mobile_money">Mobile Money</option></select></div>
            <div><label style={labelStyle}>Currency</label><input name="currency" style={inputStyle} defaultValue={editing?.currency || 'GHS'} /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setModalOpen(false); setEditing(null); }} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}