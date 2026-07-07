// client/src/modules/accounts/AccountListPage.jsx

import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiList, FiGitBranch, FiSearch } from 'react-icons/fi';
import accountService from '../../services/accountService';
import { formatCurrency, getStatusColor } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import AccountForm from './AccountForm';

export default function AccountListPage() {
  const [accounts, setAccounts] = useState([]);
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tree'
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterType) filters.type = filterType;
      const result = await accountService.getAll(filters);
      if (result.success) setAccounts(result.data);
    } catch (error) {
      showToast('Failed to fetch accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTree = async () => {
    try {
      const result = await accountService.getTree();
      if (result.success) setTreeData(result.data);
    } catch (error) {
      showToast('Failed to fetch account tree', 'error');
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchTree();
  }, [filterType]);

  const handleSave = async (accountData) => {
    try {
      if (editingAccount) {
        const result = await accountService.update(editingAccount._id, accountData);
        if (result.success) showToast('Account updated');
      } else {
        const result = await accountService.create(accountData);
        if (result.success) showToast('Account created');
      }
      setModalOpen(false);
      setEditingAccount(null);
      fetchAccounts();
      fetchTree();
    } catch (error) {
      showToast(error.response?.data?.message || 'Save failed', 'error');
    }
  };

  const openCreate = () => { setEditingAccount(null); setModalOpen(true); };
  const openEdit = (acct) => { setEditingAccount(acct); setModalOpen(true); };

  // Filter accounts by search
  const filtered = accounts.filter((a) =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense'];
  const typeLabels = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', cogs: 'COGS', expense: 'Expenses' };

  return (
    <div>
      {ToastComponent}

      {/* Page Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600,
            color: 'var(--text-primary)',
          }}>Chart of Accounts</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {accounts.length} accounts
          </p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', background: 'var(--nexusora-gold)',
          color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)',
          fontSize: 14, fontWeight: 600,
        }}>
          <FiPlus size={16} /> New Account
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '8px 14px', flex: '1 1 260px',
        }}>
          <FiSearch size={15} color="var(--text-muted)" />
          <input
            type="text" placeholder="Search by code or name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: 'var(--text-primary)', width: '100%',
            }}
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '9px 14px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff',
            color: 'var(--text-primary)', cursor: 'pointer',
          }}
        >
          <option value="">All types</option>
          {accountTypes.map((t) => (
            <option key={t} value={t}>{typeLabels[t]}</option>
          ))}
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '8px 14px', fontSize: 13,
              background: viewMode === 'list' ? 'var(--deep-navy)' : '#fff',
              color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          ><FiList size={14} /> List</button>
          <button
            onClick={() => setViewMode('tree')}
            style={{
              padding: '8px 14px', fontSize: 13,
              background: viewMode === 'tree' ? 'var(--deep-navy)' : '#fff',
              color: viewMode === 'tree' ? '#fff' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          ><FiGitBranch size={14} /> Tree</button>
        </div>
      </div>

      {/* Account List View */}
      {viewMode === 'list' && (
        <div style={{
          background: '#fff', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Normal</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Balance</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No accounts found.</td></tr>
              ) : filtered.map((acct, i) => {
                const statusColors = getStatusColor(acct.isActive ? 'active' : 'inactive');
                return (
                  <tr key={acct._id} style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                  }}>
                    <td style={{ padding: '11px 16px', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>
                      {acct.parentCode ? '  └ ' : ''}{acct.code}
                    </td>
                    <td style={{ padding: '11px 16px' }}>{acct.name}</td>
                    <td style={{ padding: '11px 16px', textTransform: 'capitalize' }}>{acct.type}</td>
                    <td style={{ padding: '11px 16px', textTransform: 'capitalize' }}>{acct.normalBalance}</td>
                    <td style={{
                      padding: '11px 16px', textAlign: 'right',
                      fontFamily: 'monospace', fontWeight: 500,
                      color: acct.balance < 0 ? 'var(--danger)' : 'var(--text-primary)',
                    }}>
                      {formatCurrency(acct.balance)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: statusColors.bg, color: statusColors.text,
                        border: `1px solid ${statusColors.border}`,
                      }}>
                        {acct.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <button onClick={() => openEdit(acct)} style={{
                        padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                        color: 'var(--tech-blue)', fontSize: 12,
                      }}>
                        <FiEdit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tree View */}
      {viewMode === 'tree' && treeData && (
        <div style={{ display: 'grid', gap: 20 }}>
          {Object.entries(treeData).map(([type, accts]) => (
            <div key={type} style={{
              background: '#fff', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px', background: 'var(--bg-app)',
                borderBottom: '1px solid var(--border)',
                fontWeight: 600, fontSize: 14, textTransform: 'capitalize',
                color: 'var(--text-primary)',
              }}>{typeLabels[type] || type} ({accts.length})</div>
              <div style={{ padding: '8px 0' }}>
                {accts.map((parent) => (
                  <div key={parent._id}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '10px 20px', fontSize: 13,
                    }}>
                      <span><strong style={{ fontFamily: 'monospace' }}>{parent.code}</strong> — {parent.name}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{formatCurrency(parent.balance)}</span>
                    </div>
                    {parent.children && parent.children.map((child) => (
                      <div key={child._id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '8px 20px 8px 48px', fontSize: 13,
                        color: 'var(--text-secondary)',
                      }}>
                        <span>└ <span style={{ fontFamily: 'monospace' }}>{child.code}</span> — {child.name}</span>
                        <span style={{ fontFamily: 'monospace' }}>{formatCurrency(child.balance)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAccount(null); }}
        title={editingAccount ? 'Edit Account' : 'New Account'}
      >
        <AccountForm
          account={editingAccount}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditingAccount(null); }}
        />
      </Modal>
    </div>
  );
}