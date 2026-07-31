// client/src/modules/invoicing/CustomerListPage.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiPlus, FiSearch } from 'react-icons/fi';
import { exportCustomers } from '../reports/dataExports';
import customerService from '../../services/customerService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import { useTenant } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import ActionMenu from '../../components/common/ActionMenu';
import { getSubdomain } from '../../services/api';
// 👇 ADDED: ResponsiveTable import
import ResponsiveTable from '../../components/common/ResponsiveTable';
import { openAuthedPdf } from '../../utils/openAuthedPdf';

function CustomerForm({ customer, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    taxId: customer?.taxId || '',
    creditLimit: customer?.creditLimit || 0,
    currency: customer?.currency || '',
  });
  const { settings: custSettings } = useTenant();
  const enabledCurrencies = custSettings?.currencies || [];
  const baseCur = custSettings?.baseCurrency || 'GHS';

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  };

  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 500,
    color: 'var(--text-secondary)', marginBottom: 6,
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Customer Name *</label>
        <input
          style={inputStyle}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Company or individual name"
          required
          onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="customer@email.com"
          />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            style={inputStyle}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+233..."
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Address</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Street, City, Region"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Tax ID (TIN)</label>
          <input
            style={inputStyle}
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            placeholder="GRA TIN"
          />
        </div>
        <div>
          <label style={labelStyle}>Credit Limit (GHS)</label>
          <input
            style={inputStyle}
            type="number"
            step="0.01"
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
          />
        </div>
        {enabledCurrencies.length > 0 && (
          <div>
            <label style={labelStyle}>Currency</label>
            <select style={inputStyle} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="">{baseCur} (default)</option>
              {enabledCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 22px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', fontSize: 14,
            color: 'var(--text-secondary)', background: '#fff',
          }}
        >Cancel</button>
        <button
          type="submit"
          style={{
            padding: '10px 22px', borderRadius: 'var(--radius-sm)',
            background: 'var(--nexusora-gold)', color: 'var(--deep-navy)',
            fontSize: 14, fontWeight: 600,
          }}
        >{customer ? 'Update' : 'Create'} Customer</button>
      </div>
    </form>
  );
}

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { showToast, ToastComponent } = useToast();
  const { companyName } = useTenant();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await customerService.getAll();
      if (res.success) setCustomers(res.data);
    } catch {
      showToast('Failed to fetch customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleSave = async (data) => {
    try {
      if (editing) {
        const res = await customerService.update(editing._id, data);
        if (res.success) showToast('Customer updated');
      } else {
        const res = await customerService.create(data);
        if (res.success) showToast('Customer created');
      }
      setModalOpen(false);
      setEditing(null);
      fetchCustomers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <div>
      {ToastComponent}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600,
            color: 'var(--text-primary)',
          }}>Customers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {customers.length} customers
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: 'var(--nexusora-gold)',
            color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)',
            fontSize: 14, fontWeight: 600,
          }}
        >
          <FiPlus size={16} /> New Customer
        </button>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '8px 14px',
        marginBottom: 20, maxWidth: 380,
      }}>
        <FiSearch size={15} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: 'var(--text-primary)', width: '100%',
          }}
        />
        <button onClick={() => exportCustomers(customers, companyName)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--nexusora-gold, #C9A227)', background: '#fff', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FiDownload size={15} /> Export Excel
        </button>
      </div>

      {/* 👇 CHANGED: outer div – removed border and overflow, added ResponsiveTable wrapper */}
      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
        <ResponsiveTable minWidth={700}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Tax ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Credit Limit</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Outstanding</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {search ? `No customers matching "${search}"` : 'No customers yet. Click "New Customer" to add one.'}
                  </td>
                </tr>
              ) : filtered.map((c, i) => (
                <tr
                  key={c._id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: !c.isActive ? '#FAFAFA' : i % 2 === 0 ? '#fff' : '#FAFBFC',
                    opacity: !c.isActive ? 0.6 : 1,
                  }}
                >
                  <td style={{ padding: '11px 16px', fontWeight: 500 }}>
                    {c.name}
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--text-secondary)' }}>
                    {c.email || '—'}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    {c.phone || '—'}
                  </td>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                    {c.taxId || '—'}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(c.creditLimit)}
                  </td>
                  <td style={{
                    padding: '11px 16px', textAlign: 'right',
                    fontFamily: 'monospace', fontWeight: 500,
                    color: c.outstandingBalance > 0 ? 'var(--warning)' : 'var(--text-primary)',
                  }}>
                    {formatCurrency(c.outstandingBalance)}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                    <ActionMenu items={[
                      { icon: '✏️', label: 'Edit Customer', onClick: () => { setEditing(c); setModalOpen(true); } },
                      { icon: '📤', label: 'New Invoice', onClick: () => navigate('/invoicing/new') },
                      { icon: '💰', label: 'Receive Payment', onClick: () => navigate('/invoicing/receive-payment') },
                      { icon: '📋', label: 'View Invoices', onClick: () => navigate('/invoicing/invoices') },
                      { icon: '🖨️', label: 'Print Statement', onClick: () => openAuthedPdf(`/api/customers/${c._id}/statement`, `statement-${c.name}.pdf`).catch((e) => showToast(e.message, 'error')), dividerBefore: true },                  
                          {
                        icon: c.isActive ? '🚫' : '✅',label: c.isActive ? 'Deactivate' : 'Activate',
                        onClick: async () => {
                          if (!window.confirm(`${c.isActive ? 'Deactivate' : 'Activate'} ${c.name}?`)) return;
                          try {
                           const { data } = await api.patch(`/customers/${c._id}/toggle-active`);
                           if (data.success) { showToast(data.message); fetchCustomers(); }
                          } catch (err) {
                            console.error('TOGGLE ERROR:', err);
                            showToast('Failed: ' + (err?.response?.data?.message || err?.message || 'unknown'), 'error');
                          }
                        },
                        variant: c.isActive ? 'danger' : 'success',
                        dividerBefore: true,
                      },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        {/* 👇 ADDED: closing ResponsiveTable */}
        </ResponsiveTable>
      </div>

      {/* Summary footer */}
      {customers.length > 0 && (
        <div style={{
          marginTop: 12, padding: '10px 16px', background: 'var(--bg-app)',
          borderRadius: 'var(--radius-sm)', fontSize: 13,
          display: 'flex', gap: 24, color: 'var(--text-secondary)',
        }}>
          <span>Total customers: <strong>{customers.length}</strong></span>
          <span>Active: <strong>{customers.filter((c) => c.isActive).length}</strong></span>
          <span>Total outstanding: <strong style={{ color: 'var(--warning)' }}>
            {formatCurrency(customers.reduce((s, c) => s + (c.outstandingBalance || 0), 0))}
          </strong></span>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? `Edit Customer — ${editing.name}` : 'New Customer'}
        width={560}
      >
        <CustomerForm
          customer={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(null); }}
        />
      </Modal>
    </div>
  );
}