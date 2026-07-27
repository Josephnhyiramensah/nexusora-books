// client/src/modules/invoicing/InvoiceListPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiPlus } from 'react-icons/fi';
import { exportInvoices } from '../reports/dataExports';
import { motion } from 'framer-motion';
import invoiceService from '../../services/invoiceService';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import ActionMenu from '../../components/common/ActionMenu';
import EntryDetailsModal from '../../components/common/EntryDetailsModal';
import api from '../../services/api';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import { openAuthedPdf } from '../../utils/openAuthedPdf';

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [viewInvoice, setViewInvoice] = useState(null);
  const [recurringInvoice, setRecurringInvoice] = useState(null);
  const [recurFreq, setRecurFreq] = useState('monthly');
  const [recurEnd, setRecurEnd] = useState('');
  const [recurSaving, setRecurSaving] = useState(false);
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const { user } = useAuth();
  const canApprove = ['super_admin', 'admin'].includes(user?.role);
  const { companyName } = useTenant();

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus) filters.status = filterStatus;
      const res = await invoiceService.getAll(filters);
      if (res.success) setInvoices(res.data);
    } catch {
      showToast('Failed to fetch invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const runRecurring = async () => {
    try {
      const { data } = await api.post('/invoices/recurring/run');
      if (data.success && data.data?.created?.length) {
        showToast('Generated ' + data.data.created.length + ' recurring invoice(s)');
        fetchInvoices();
      }
    } catch { /* silent — generation is best-effort on load */ }
  };
  useEffect(() => { fetchInvoices(); }, [filterStatus]);
  useEffect(() => { runRecurring(); }, []);

  const submitRecurring = async () => {
    if (!recurringInvoice) return;
    setRecurSaving(true);
    try {
      const { data } = await api.post('/invoices/' + recurringInvoice._id + '/recurring', {
        frequency: recurFreq,
        endDate: recurEnd || undefined,
      });
      if (data.success) { showToast(data.message); setRecurringInvoice(null); setRecurEnd(''); fetchInvoices(); }
      else showToast(data.message || 'Failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Failed to set recurring', 'error'); }
    finally { setRecurSaving(false); }
  };

  const handleSend = async (id) => {
    if (!window.confirm('Send this invoice? This creates a journal entry and updates account balances.')) return;
    try {
      const res = await invoiceService.send(id);
      if (res.success) { showToast(res.message); fetchInvoices(); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to send', 'error'); }
  };

  const handleDelete = async (id, invoiceNumber) => {
    if (!window.confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    try {
      const { data } = await api.delete(`/invoices/${id}`);
      if (data.success) { showToast('Invoice deleted'); fetchInvoices(); }
    } catch (err) { showToast(err.response?.data?.message || 'Cannot delete — only drafts can be deleted', 'error'); }
  };

  const openView = async (id) => {
    try { const { data } = await api.get('/invoices/' + id); if (data.success) setViewInvoice(data.data); }
    catch { showToast('Could not load invoice', 'error'); }
  };

  const handleApproveEntry = async (id) => {
    if (!window.confirm('Approve and post this invoice?')) return;
    try {
      const { data } = await api.post(''/invoices'/' + id + '/approve');
      if (data.success) { showToast(data.message || 'Approved'); fetchInvoices(); }
      else showToast(data.message || 'Approve failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Approve failed', 'error'); }
  };
  const handleRejectEntry = async (id) => {
    const reason = window.prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      const { data } = await api.post(''/invoices'/' + id + '/reject', { reason });
      if (data.success) { showToast(data.message || 'Rejected'); fetchInvoices(); }
      else showToast(data.message || 'Reject failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Reject failed', 'error'); }
  };

  const getActionItems = (inv) => {
    const items = [];
    if (inv.status === 'awaiting_approval' && canApprove) {
      items.push({ icon: '✅', label: 'Approve', onClick: () => handleApproveEntry(inv._id), variant: 'success' });
      items.push({ icon: '❌', label: 'Reject', onClick: () => handleRejectEntry(inv._id), variant: 'danger' });
    }
    items.push({ icon: '👁️', label: 'View details', onClick: () => openView(inv._id) });

    if (inv.status === 'draft') {
      items.push({
        icon: '✏️', label: 'Edit Invoice',
        onClick: () => navigate(`/invoicing/new`),
      });
      items.push({
        icon: '📤', label: 'Send Invoice',
        onClick: () => handleSend(inv._id),
        variant: 'success',
      });
    }

    if (['sent', 'partially_paid', 'overdue'].includes(inv.status)) {
      items.push({
        icon: '💰', label: 'Receive Payment',
        onClick: () => navigate('/invoicing/receive-payment'),
        variant: 'success',
      });
    }

    items.push({
      icon: '📋', label: 'View Customer',
      onClick: () => navigate('/invoicing/customers'),
      dividerBefore: true,
    });

    items.push({
      icon: '🔁', label: inv.isRecurringTemplate ? 'Recurring: ' + (inv.recurring?.frequency || 'on') : 'Make recurring',
      onClick: () => { setRecurringInvoice(inv); setRecurFreq(inv.recurring?.frequency || 'monthly'); },
      dividerBefore: true,
    });
    items.push({
      icon: '🖨️', label: 'Print Invoice',
      onClick: () => openAuthedPdf(`/api/invoices/${inv._id}/pdf`, `${inv.invoiceNumber}.pdf`)
        .catch((e) => showToast(e.message, 'error')),
    });
    if (inv.status === 'draft') {
      items.push({
        icon: '🗑️', label: 'Delete Invoice',
        onClick: () => handleDelete(inv._id, inv.invoiceNumber),
        variant: 'danger',
        dividerBefore: true,
      });
    }

    return items;
  };

  return (
    <div>
      {ToastComponent}
      {recurringInvoice && (
        <div onClick={() => !recurSaving && setRecurringInvoice(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 'var(--radius-md)', width: 440, maxWidth: '94vw', padding: '24px 26px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 6 }}>Make Invoice Recurring</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>{recurringInvoice.invoiceNumber} · {recurringInvoice.customer?.name || ''}. A fresh draft invoice will be created automatically each period for you to review and send.</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Frequency</label>
            <select value={recurFreq} onChange={(e) => setRecurFreq(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, marginBottom: 16 }}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>End date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <input type="date" value={recurEnd} onChange={(e) => setRecurEnd(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, marginBottom: 22 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRecurringInvoice(null)} style={{ padding: '9px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitRecurring} disabled={recurSaving} style={{ padding: '9px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{recurSaving ? 'Saving...' : 'Set Recurring'}</button>
            </div>
          </div>
        </div>
      )}
      <EntryDetailsModal
        open={!!viewInvoice}
        onClose={() => setViewInvoice(null)}
        title={viewInvoice ? viewInvoice.invoiceNumber : ''}
        subtitle={viewInvoice ? (viewInvoice.customer?.name || '') : ''}
        record={viewInvoice || {}}
        rows={viewInvoice ? [
          ['Customer', viewInvoice.customer?.name || '—'],
          ['Date', new Date(viewInvoice.date).toLocaleDateString('en-GB')],
          ['Due Date', new Date(viewInvoice.dueDate).toLocaleDateString('en-GB')],
          ['Total', 'GHS ' + Number(viewInvoice.total||0).toFixed(2)],
          ['Balance', 'GHS ' + Number(viewInvoice.balance||0).toFixed(2)],
          ['Status', viewInvoice.status],
        ] : []}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>
            Invoices
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {invoices.length} total invoices
          </p>
        </div>
          <button
          onClick={() => navigate('/invoicing/new')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: 'var(--nexusora-gold)', color: 'var(--deep-navy)',
            borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600,
            border: 'none', cursor: 'pointer',
          }}
        >
          <FiPlus size={16} /> New Invoice
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '9px 14px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff',
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <button onClick={() => exportInvoices(invoices, companyName)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--nexusora-gold, #C9A227)', background: '#fff', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FiDownload size={15} /> Export Excel
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
        <ResponsiveTable minWidth={700}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Invoice #</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Due Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Balance</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No invoices yet. Click "New Invoice" to create one.
                  </td>
                </tr>
              ) : invoices.map((inv, i) => {
                const sc = getStatusColor(inv.status);
                const isOverdue = new Date(inv.dueDate) < new Date() && inv.status !== 'paid';
                return (
                  <tr
                    key={inv._id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                    }}
                  >
                    <td style={{ padding: '11px 16px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ padding: '11px 16px' }}>{inv.customer?.name || '—'}</td>
                    <td style={{ padding: '11px 16px' }}>{formatDate(inv.date)}</td>
                    <td style={{ padding: '11px 16px', color: isOverdue ? 'var(--danger)' : 'inherit' }}>
                      {formatDate(inv.dueDate)}
                      {isOverdue && <span style={{ fontSize: 10, marginLeft: 6, fontWeight: 600 }}>OVERDUE</span>}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(inv.total)}
                    </td>
                    <td style={{
                      padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace',
                      color: inv.balance > 0 ? 'var(--warning)' : 'var(--success)',
                      fontWeight: 600,
                    }}>
                      {formatCurrency(inv.balance)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center', position: 'relative' }}>
                      <ActionMenu items={getActionItems(inv)} />
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