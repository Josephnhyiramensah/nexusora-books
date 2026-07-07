import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowRight } from 'react-icons/fi';
import api from '../../services/api';

// All searchable modules
const MODULE_INDEX = [
  { label: 'Dashboard', path: '/dashboard', keywords: ['dashboard', 'overview', 'summary', 'home'] },
  { label: 'Chart of Accounts', path: '/assets', keywords: ['accounts', 'chart', 'coa', 'ledger', 'asset', 'liability', 'equity'] },
  { label: 'Journal Entries', path: '/journals', keywords: ['journal', 'entries', 'debit', 'credit', 'posting'] },
  { label: 'New Journal Entry', path: '/journals/new', keywords: ['new journal', 'create journal', 'add entry'] },
  { label: 'Customers', path: '/invoicing/customers', keywords: ['customer', 'client', 'buyer', 'debtor'] },
  { label: 'Invoices', path: '/invoicing/invoices', keywords: ['invoice', 'bill to', 'receivable', 'sales'] },
  { label: 'New Invoice', path: '/invoicing/new', keywords: ['new invoice', 'create invoice'] },
  { label: 'Receive Payment', path: '/invoicing/receive-payment', keywords: ['receive', 'receipt', 'incoming', 'collection'] },
  { label: 'Vendors', path: '/bills/vendors', keywords: ['vendor', 'supplier', 'creditor'] },
  { label: 'Bills', path: '/bills/list', keywords: ['bill', 'expense', 'payable', 'purchase'] },
  { label: 'New Bill', path: '/bills/new', keywords: ['new bill', 'create bill'] },
  { label: 'Make Payment', path: '/bills/make-payment', keywords: ['pay', 'payment', 'outgoing', 'disburse'] },
  { label: 'Inventory', path: '/inventory', keywords: ['inventory', 'stock', 'item', 'product', 'sku', 'warehouse'] },
  { label: 'Fixed Assets', path: '/fixed-assets', keywords: ['asset', 'equipment', 'vehicle', 'furniture', 'depreciation'] },
  { label: 'Payroll', path: '/payroll', keywords: ['payroll', 'salary', 'wage', 'paye', 'ssnit', 'employee', 'staff'] },
  { label: 'Banking', path: '/banking', keywords: ['bank', 'account', 'gcb', 'momo', 'mobile money', 'transfer'] },
  { label: 'Budgets', path: '/budget', keywords: ['budget', 'forecast', 'plan', 'variance'] },
  { label: 'Tax', path: '/tax', keywords: ['tax', 'vat', 'paye', 'gra', 'ssnit', 'tin', 'withholding'] },
  { label: 'Trial Balance', path: '/reports/trial-balance', keywords: ['trial balance', 'tb'] },
  { label: 'Profit & Loss', path: '/reports/profit-loss', keywords: ['profit', 'loss', 'income statement', 'p&l', 'pnl'] },
  { label: 'Balance Sheet', path: '/reports/balance-sheet', keywords: ['balance sheet', 'financial position'] },
  { label: 'Cash Flow', path: '/reports/cash-flow', keywords: ['cash flow', 'liquidity'] },
  { label: 'General Ledger', path: '/reports/general-ledger', keywords: ['general ledger', 'gl', 'transactions'] },
  { label: 'Notes', path: '/notes', keywords: ['note', 'memo', 'announcement', 'reminder'] },
  { label: 'To-Do List', path: '/todos', keywords: ['todo', 'task', 'checklist', 'assignment'] },
  { label: 'Settings', path: '/settings', keywords: ['settings', 'profile', 'company', 'password', 'user', 'role'] },
];

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [accountResults, setAccountResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handle = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K to open search
  useEffect(() => {
    const handle = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setAccountResults([]);
      return;
    }

    const q = query.toLowerCase();

    // Search modules
    const moduleMatches = MODULE_INDEX.filter((m) =>
      m.label.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.includes(q))
    ).slice(0, 6);
    setResults(moduleMatches);

    // Search accounts from API (debounced)
    const timer = setTimeout(async () => {
      if (q.length >= 2) {
        try {
          setLoading(true);
          const { data } = await api.get(`/accounts?isActive=true`);
          if (data.success) {
            const matches = data.data.filter((a) =>
              a.code.includes(q) || a.name.toLowerCase().includes(q)
            ).slice(0, 5);
            setAccountResults(matches);
          }
        } catch {} finally { setLoading(false); }
      } else {
        setAccountResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const allResults = [
    ...results.map((r) => ({ type: 'module', ...r })),
    ...accountResults.map((a) => ({ type: 'account', label: `${a.code} — ${a.name}`, path: '/assets', data: a })),
  ];

  useEffect(() => { setHighlightIndex(0); }, [query]);

  const handleSelect = (item) => {
    navigate(item.path);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || allResults.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((p) => Math.min(p + 1, allResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((p) => Math.max(p - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (allResults[highlightIndex]) handleSelect(allResults[highlightIndex]); }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: 380 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-app)', borderRadius: 'var(--radius-md)',
        padding: '8px 16px', border: isOpen ? '1px solid var(--tech-blue)' : '1px solid transparent',
        transition: 'border-color 150ms',
      }}>
        <FiSearch size={16} color="var(--text-muted)" />
        <input
          ref={inputRef}
          type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); if (!isOpen) setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search modules, accounts... (Ctrl+K)"
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: 13, color: 'var(--text-primary)', width: '100%',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setIsOpen(false); }} style={{ color: 'var(--text-muted)', fontSize: 16, padding: '0 4px' }}>×</button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && query.trim() && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)', maxHeight: 400, overflowY: 'auto', zIndex: 600,
        }}>
          {allResults.length === 0 && !loading ? (
            <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              No results for "{query}"
            </div>
          ) : (
            <>
              {results.length > 0 && (
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Modules & Pages
                </div>
              )}
              {results.map((item, i) => (
                <div key={`m-${i}`} onClick={() => handleSelect(item)} onMouseEnter={() => setHighlightIndex(i)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', cursor: 'pointer', fontSize: 13,
                    background: highlightIndex === i ? '#F0F7FF' : 'transparent',
                  }}>
                  <span style={{ fontWeight: 500 }}>{item.label}</span>
                  <FiArrowRight size={14} color="var(--text-muted)" />
                </div>
              ))}

              {accountResults.length > 0 && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                    Accounts
                  </div>
                  {accountResults.map((acct, i) => {
                    const idx = results.length + i;
                    return (
                      <div key={`a-${i}`} onClick={() => handleSelect({ path: '/assets' })} onMouseEnter={() => setHighlightIndex(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 16px', cursor: 'pointer', fontSize: 13,
                          background: highlightIndex === idx ? '#F0F7FF' : 'transparent',
                        }}>
                        <span>
                          <strong style={{ fontFamily: 'monospace', marginRight: 8 }}>{acct.code}</strong>
                          {acct.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{acct.type}</span>
                      </div>
                    );
                  })}
                </>
              )}

              {loading && <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>Searching accounts...</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}