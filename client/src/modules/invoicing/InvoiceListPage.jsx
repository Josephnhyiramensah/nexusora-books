// client/src/modules/invoicing/InvoiceListPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { motion } from 'framer-motion';
import invoiceService from '../../services/invoiceService';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import ActionMenu from '../../components/common/ActionMenu';
import api from '../../services/api';
import { openAuthedPdf } from '../../utils/openAuthedPdf';
import ResponsiveTable from '../../components/common/ResponsiveTable';

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

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

  useEffect(() => { fetchInvoices(); }, [filterStatus]);

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

  const getActionItems = (inv) => {
    const items = [];

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
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
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
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                        textTransform: 'capitalize',
                      }}>
                        {inv.status.replace('_', ' ')}
                      </span>
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