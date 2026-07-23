// client/src/modules/accounts/AccountTypePage.jsx
// Shared page for Assets, Liabilities, Equity, Revenue, Expenses views

import { useState, useEffect } from 'react';
import { FiSearch, FiChevronRight } from 'react-icons/fi';
import accountService from '../../services/accountService';
import reportService from '../../services/reportService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';

export default function AccountTypePage({ accountType, title, codeRange }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    setLoading(true);
    setSelectedAccount(null);
    setLedger(null);

    // Expenses includes both 'expense' and 'cogs' types
    const fetchAccounts = async () => {
      try {
        if (accountType === 'expense') {
          const [expRes, cogsRes] = await Promise.all([
            accountService.getAll({ type: 'expense' }),
            accountService.getAll({ type: 'cogs' }),
          ]);
          const combined = [...(expRes.success ? expRes.data : []), ...(cogsRes.success ? cogsRes.data : [])];
          combined.sort((a, b) => a.code.localeCompare(b.code));
          setAccounts(combined);
        } else {
          const r = await accountService.getAll({ type: accountType });
          if (r.success) setAccounts(r.data);
        }
      } catch { showToast('Failed to fetch accounts', 'error'); }
      finally { setLoading(false); }
    };

    fetchAccounts();
  }, [accountType]);

  // Load the ledger for a single account. handleSelect referenced this but it
  // was never defined, so every account click threw "fetchLedger is not defined".
  const fetchLedger = async (accountId) => {
    setLedgerLoading(true);
    setLedger(null);
    try {
      const r = await reportService.generalLedger(accountId);
      if (r.success) {
        // With an accountId filter the report returns just that one account.
        setLedger((r.data?.accounts || [])[0] || null);
      }
    } catch {
      showToast('Failed to load account ledger', 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleSelect = (acct) => {
    setSelectedAccount(acct);
    fetchLedger(acct._id);
  };

  const filtered = accounts.filter((a) =>
    a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = accounts.reduce((s, a) => s + Math.abs(a.balance || 0), 0);

  return (
    <div>
      {ToastComponent}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {accounts.length} accounts ({codeRange}) — Total: {formatCurrency(totalBalance)}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedAccount ? '340px 1fr' : '1fr', gap: 20 }}>
        {/* Account List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 12 }}>
            <FiSearch size={15} color="var(--text-muted)" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }} />
          </div>

          <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {loading ? <p style={{ padding: 20, color: 'var(--text-muted)', textAlign: 'center', fontSize: 13 }}>Loading...</p> :
            filtered.length === 0 ? <p style={{ padding: 20, color: 'var(--text-muted)', textAlign: 'center', fontSize: 13 }}>No accounts.</p> :
            filtered.map((acct) => (
              <div key={acct._id} onClick={() => handleSelect(acct)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer',
                background: selectedAccount?._id === acct._id ? '#EBF5FF' : 'transparent',
                transition: 'background 100ms',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--deep-navy)' }}>{acct.code}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{acct.name}</span>
                  </div>
                  {acct.category && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{acct.category}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 600,
                    color: acct.balance === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>{formatCurrency(Math.abs(acct.balance || 0))}</span>
                  <FiChevronRight size={14} color="var(--text-muted)" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ledger Detail */}
        {selectedAccount && (
          <div>
            <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* Account header */}
              <div style={{ padding: '18px 24px', background: 'var(--deep-navy)', color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                      <span style={{ fontFamily: 'monospace', marginRight: 10 }}>{selectedAccount.code}</span>
                      {selectedAccount.name}
                    </h2>
                    <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4, textTransform: 'capitalize' }}>
                      {selectedAccount.type} • {selectedAccount.normalBalance} normal • {selectedAccount.category || 'Uncategorised'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, opacity: 0.6 }}>Current Balance</p>
                    <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(Math.abs(selectedAccount.balance || 0))}</p>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              {ledgerLoading ? (
                <p style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading transactions...</p>
              ) : !ledger || ledger.transactions.length === 0 ? (
                <p style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No transactions recorded for this account.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Entry #</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Debit</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Credit</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.transactions.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(t.date)}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 12 }}>{t.entryNumber}</td>
                        <td style={{ padding: '8px 14px' }}>{t.description}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{t.debit > 0 ? t.debit.toFixed(2) : ''}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{t.credit > 0 ? t.credit.toFixed(2) : ''}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{t.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--deep-navy)', fontWeight: 700 }}>
                      <td colSpan={5} style={{ padding: '10px 14px' }}>Closing Balance</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14 }}>{ledger.closingBalance.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}