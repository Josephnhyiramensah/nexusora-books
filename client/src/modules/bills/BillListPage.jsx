import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiPlus } from 'react-icons/fi';
import { exportBills } from '../reports/dataExports';
import billService from '../../services/billService';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import ActionMenu from '../../components/common/ActionMenu';
import EntryDetailsModal from '../../components/common/EntryDetailsModal';
import api from '../../services/api';
import ResponsiveTable from '../../components/common/ResponsiveTable';

export default function BillListPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [viewBill, setViewBill] = useState(null);
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const { user } = useAuth();
  const canApprove = ['super_admin', 'admin'].includes(user?.role);
  const { companyName } = useTenant();

  const fetchBills = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus) filters.status = filterStatus;
      const r = await billService.getAll(filters);
      if (r.success) setBills(r.data);
    } catch { showToast('Failed to fetch bills', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBills(); }, [filterStatus]);

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this bill? This will create a journal entry and update account balances.')) return;
    try {
      const r = await billService.approve(id);
      if (r.success) { showToast(r.message); fetchBills(); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleDelete = async (id, billNumber) => {
    if (!window.confirm(`Delete bill ${billNumber}? This cannot be undone.`)) return;
    try {
      const { data } = await api.delete(`/bills/${id}`);
      if (data.success) { showToast('Bill deleted'); fetchBills(); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const openView = async (id) => {
    try { const { data } = await api.get('/bills/' + id); if (data.success) setViewBill(data.data); }
    catch { showToast('Could not load bill', 'error'); }
  };

  const handleApproveEntry = async (id) => {
    if (!window.confirm('Approve and post this bill?')) return;
    try {
      const { data } = await api.post('/bills/' + id + '/confirm');
      if (data.success) { showToast(data.message || 'Approved'); fetchBills(); }
      else showToast(data.message || 'Approve failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Approve failed', 'error'); }
  };
  const handleRejectEntry = async (id) => {
    const reason = window.prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      const { data } = await api.post('/bills/' + id + '/reject', { reason });
      if (data.success) { showToast(data.message || 'Rejected'); fetchBills(); }
      else showToast(data.message || 'Reject failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Reject failed', 'error'); }
  };

  const getActionItems = (b) => {
    const items = [];
    if (b.status === 'awaiting_approval' && canApprove) {
      items.push({ icon: '✅', label: 'Approve', onClick: () => handleApproveEntry(b._id), variant: 'success' });
      items.push({ icon: '❌', label: 'Reject', onClick: () => handleRejectEntry(b._id), variant: 'danger' });
    }

    if (b.status === 'draft') {
      items.push({ icon: '✏️', label: 'Edit Bill', onClick: () => navigate(`/bills/edit/${b._id}`) });
      items.push({ icon: '✅', label: 'Approve Bill', onClick: () => handleApprove(b._id), variant: 'success' });
    }

    if (['approved', 'partially_paid'].includes(b.status)) {
      items.push({ icon: '💸', label: 'Make Payment', onClick: () => navigate('/bills/make-payment'), variant: 'success' });
    }

    items.push({ icon: '🖨️', label: 'Print Bill', onClick: () => window.print(), dividerBefore: items.length > 0 });
    items.push({ icon: '📋', label: 'View Vendor', onClick: () => navigate('/bills/vendors') });

    if (b.status === 'draft') {
      items.push({
        icon: '🗑️', label: 'Delete Bill',
        onClick: () => handleDelete(b._id, b.billNumber),
        variant: 'danger', dividerBefore: true,
      });
    }

    return items;
  };

  return (
    <div>
      {ToastComponent}
      <EntryDetailsModal
        open={!!viewBill}
        onClose={() => setViewBill(null)}
        title={viewBill ? viewBill.billNumber : ''}
        subtitle={viewBill ? (viewBill.vendor?.name || '') : ''}
        record={viewBill || {}}
        rows={viewBill ? [
          ['Vendor', viewBill.vendor?.name || '—'],
          ['Date', new Date(viewBill.date).toLocaleDateString('en-GB')],
          ['Due Date', new Date(viewBill.dueDate).toLocaleDateString('en-GB')],
          ['Total', 'GHS ' + Number(viewBill.total||0).toFixed(2)],
          ['Balance', 'GHS ' + Number(viewBill.balance||0).toFixed(2)],
          ['Status', viewBill.status],
        ] : []}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Bills</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{bills.length} bills</p>
        </div>
          <button onClick={() => navigate('/bills/new')} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
          background: 'var(--nexusora-gold)', color: 'var(--deep-navy)',
          borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
        }}>
          <FiPlus size={16} /> New Bill
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff' }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
        </select>
        <button onClick={() => exportBills(bills, companyName)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--nexusora-gold, #C9A227)', background: '#fff', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FiDownload size={15} /> Export Excel
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
        <ResponsiveTable minWidth={700}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Bill #</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Vendor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Due</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Balance</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No bills yet.</td></tr>
              ) : bills.map((b, i) => {
                const sc = getStatusColor(b.status);
                return (
                  <tr key={b._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 600, fontFamily: 'monospace' }}>{b.billNumber}</td>
                    <td style={{ padding: '11px 16px' }}>{b.vendor?.name || '—'}</td>
                    <td style={{ padding: '11px 16px' }}>{formatDate(b.date)}</td>
                    <td style={{ padding: '11px 16px', color: new Date(b.dueDate) < new Date() && b.status !== 'paid' ? 'var(--danger)' : 'inherit' }}>
                      {formatDate(b.dueDate)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(b.total)}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', color: b.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {formatCurrency(b.balance)}
                    </td>

                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <ActionMenu items={getActionItems(b)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>
    </div>
  );
}