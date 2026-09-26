// client/src/modules/vouchers/VoucherListPage.jsx
import { useState, useEffect, useMemo } from 'react';
import VoucherActionsMenu from './VoucherActionsMenu';
import useIsMobile from '../../hooks/useIsMobile';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPlus, FiEye, FiCornerDownLeft, FiCheckCircle, FiTrash2 } from 'react-icons/fi';
import voucherService from '../../services/voucherService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

const TYPE_LABELS = {
  payment: 'Payment', receipt: 'Receipt', contra: 'Contra', transfer: 'Transfer',
  journal: 'Journal', purchase: 'Purchase', sales: 'Sales',
  debit_note: 'Debit Note', credit_note: 'Credit Note',
};

// Map a sidebar path segment to a voucher type filter.
const PATH_TYPE = {
  '/vouchers/payment': 'payment', '/vouchers/receipt': 'receipt',
  '/vouchers/contra': 'contra', '/vouchers/journal': 'journal',
  '/vouchers/purchase': 'purchase', '/vouchers/sales': 'sales',
};

const statusStyle = (status) => {
  const map = {
    draft:            { bg: '#FEF3C7', color: '#92400E', label: 'Draft' },
    awaiting_approval:{ bg: '#DBEAFE', color: '#1E40AF', label: 'Awaiting' },
    posted:           { bg: '#D1FAE5', color: '#065F46', label: 'Posted' },
    reversed:         { bg: '#FEE2E2', color: '#991B1B', label: 'Reversed' },
  };
  return map[status] || map.draft;
};

export default function VoucherListPage() {
  const isMobile = useIsMobile();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, ToastComponent } = useToast();
  const { user } = useAuth();
  const canReverse = ['super_admin', 'admin'].includes(user?.role);

    const { branches } = useBranch();
  const multiBranch = (branches || []).filter((b) => b.isActive).length > 1;
  const branchById = useMemo(() => {
    const m = {};
    (branches || []).forEach((b) => { m[String(b._id)] = b; });
    return m;
  }, [branches]);
  const branchCodeOf = (v) => {
    if (!v.branch) return '—';
    const b = branchById[String(v.branch?._id || v.branch)];
    return b ? (b.code || b.name) : '—';
  };

  // Derive type filter from the current sidebar path.
  useEffect(() => {
    setFilterType(PATH_TYPE[location.pathname] || '');
  }, [location.pathname]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterType) filters.type = filterType;
      if (filterStatus) filters.status = filterStatus;
      const result = await voucherService.getAll(filters);
      if (result.success) setVouchers(result.data);
    } catch {
      showToast('Failed to fetch vouchers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVouchers(); }, [filterType, filterStatus]);

  const handlePost = async (id) => {
    if (!window.confirm('Post this voucher? It will create a journal entry and update balances (only reversible, not editable).')) return;
    try {
      const result = await voucherService.post(id);
      if (result.success) { showToast(result.message); fetchVouchers(); }
      else showToast(result.message || 'Post failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Failed to post', 'error'); }
  };

  const handleReverse = async (id) => {
    if (!window.confirm('Reverse this voucher? A reversing journal entry will be posted.')) return;
    try {
      const result = await voucherService.reverse(id);
      if (result.success) { showToast(result.message); fetchVouchers(); }
      else showToast(result.message || 'Reverse failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Failed to reverse', 'error'); }
  };

  const handlePrint = (id) => navigate(`/vouchers/${id}`);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft voucher? This cannot be undone.')) return;
    try {
      const result = await voucherService.delete(id);
      if (result.success) { showToast(result.message); fetchVouchers(); }
      else showToast(result.message || 'Delete failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Failed to delete', 'error'); }
  };

  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6B7280)', borderBottom: '1px solid var(--border, #E5E7EB)', textTransform: 'uppercase' };
  const td = { padding: '12px', fontSize: 14, borderBottom: '1px solid var(--border, #F0F0F0)', color: 'var(--text-primary, #222)' };
  const iconBtn = { padding: 7, borderRadius: 7, border: '1px solid var(--border, #E5E7EB)', background: 'transparent', cursor: 'pointer', marginRight: 6 };

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>
          {filterType ? `${TYPE_LABELS[filterType]} Vouchers` : 'All Vouchers'}
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 13 }}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
          </select>
          <button onClick={() => navigate('/vouchers/new')}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--nexusora-gold, #FD9C09)', color: 'var(--deep-navy, #012158)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FiPlus size={15} /> New Voucher
          </button>
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
          ) : vouchers.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF' }}>No vouchers yet. Tap “New Voucher” to create one.</div>
          ) : vouchers.map((v) => {
            const s2 = statusStyle(v.status);
            return (
              <div key={v._id} style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{v.voucherNumber}</span>
                  <span style={{ background: s2.bg, color: s2.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s2.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #6B7280)', marginBottom: 6 }}>
                  {TYPE_LABELS[v.voucherType] || v.voucherType} · {formatDate(v.date)}{multiBranch ? ` · ${branchCodeOf(v)}` : ''}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 10 }}>
                  <span>{v.partyName || '—'}</span>
                  <strong>{formatCurrency(v.amount)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate(`/vouchers/${v._id}`)}>View</button>
                  {v.status === 'draft' && (
                    <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #065F46', color: '#065F46', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => handlePost(v._id)}>Post</button>
                  )}
                  {v.status === 'draft' && (
                    <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #DC2626', color: '#DC2626', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => handleDelete(v._id)}>Delete</button>
                  )}
                  {v.status === 'posted' && canReverse && (
                    <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #B45309', color: '#B45309', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => handleReverse(v._id)}>Reverse</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead>
              <tr>
                <th style={th}>Voucher #</th>
                <th style={th}>Type</th>
                <th style={th}>Date</th>
                {multiBranch && <th style={th}>Branch</th>}
                <th style={th}>Party</th>
                <th style={th}>Amount</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td style={{ ...td, textAlign: 'center', color: '#9CA3AF' }} colSpan={multiBranch ? 8 : 7}>Loading…</td></tr>
              ) : vouchers.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: '#9CA3AF' }} colSpan={multiBranch ? 8 : 7}>No vouchers yet. Click “New Voucher” to create one.</td></tr>
              ) : vouchers.map((v) => {
                const s = statusStyle(v.status);
                return (
                  <tr key={v._id}>
                    <td style={{ ...td, fontWeight: 600 }}>{v.voucherNumber}</td>
                    <td style={td}>{TYPE_LABELS[v.voucherType] || v.voucherType}</td>
                    <td style={td}>{formatDate(v.date)}</td>
                    {multiBranch && <td style={td}>{branchCodeOf(v)}</td>}
                    <td style={td}>{v.partyName || '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{formatCurrency(v.amount)}</td>
                    <td style={td}><span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s.label}</span></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <VoucherActionsMenu
                        voucher={v}
                        canReverse={canReverse}
                        onView={() => navigate(`/vouchers/${v._id}`)}
                        onPrint={() => handlePrint(v._id)}
                        onPost={() => handlePost(v._id)}
                        onReverse={() => handleReverse(v._id)}
                        onDelete={() => handleDelete(v._id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}