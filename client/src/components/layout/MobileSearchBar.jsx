import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiArrowRight } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const MODULE_INDEX = [
  { label: 'Dashboard',        path: '/dashboard',               keywords: ['dashboard', 'overview', 'summary'] },
  { label: 'Chart of Accounts',path: '/assets',                  keywords: ['accounts', 'chart', 'coa', 'asset'] },
  { label: 'Journal Entries',  path: '/journals',                keywords: ['journal', 'entries', 'debit', 'credit'] },
  { label: 'New Journal',      path: '/journals/new',            keywords: ['new journal', 'create journal'] },
  { label: 'Customers',        path: '/invoicing/customers',     keywords: ['customer', 'client', 'buyer'] },
  { label: 'Invoices',         path: '/invoicing/invoices',      keywords: ['invoice', 'receivable', 'sales'] },
  { label: 'New Invoice',      path: '/invoicing/new',           keywords: ['new invoice'] },
  { label: 'Receive Payment',  path: '/invoicing/receive-payment', keywords: ['receive', 'receipt', 'incoming'] },
  { label: 'Vendors',          path: '/bills/vendors',           keywords: ['vendor', 'supplier'] },
  { label: 'Bills',            path: '/bills/list',              keywords: ['bill', 'payable', 'purchase'] },
  { label: 'New Bill',         path: '/bills/new',               keywords: ['new bill'] },
  { label: 'Make Payment',     path: '/bills/make-payment',      keywords: ['pay', 'payment', 'outgoing'] },
  { label: 'Inventory',        path: '/inventory',               keywords: ['inventory', 'stock', 'item', 'product'] },
  { label: 'Fixed Assets',     path: '/fixed-assets',            keywords: ['asset', 'equipment', 'depreciation'] },
  { label: 'Payroll',          path: '/payroll',                 keywords: ['payroll', 'salary', 'paye', 'ssnit', 'employee'] },
  { label: 'Banking',          path: '/banking',                 keywords: ['bank', 'account', 'momo'] },
  { label: 'Budget',           path: '/budget',                  keywords: ['budget', 'forecast', 'variance'] },
  { label: 'Tax',              path: '/tax',                     keywords: ['tax', 'vat', 'gra', 'tin'] },
  { label: 'Trial Balance',    path: '/reports/trial-balance',   keywords: ['trial balance', 'tb'] },
  { label: 'Profit & Loss',    path: '/reports/profit-loss',     keywords: ['profit', 'loss', 'income'] },
  { label: 'Balance Sheet',    path: '/reports/balance-sheet',   keywords: ['balance sheet'] },
  { label: 'Cash Flow',        path: '/reports/cash-flow',       keywords: ['cash flow'] },
  { label: 'General Ledger',   path: '/reports/general-ledger',  keywords: ['general ledger', 'gl'] },
  { label: 'Notes',            path: '/notes',                   keywords: ['note', 'memo', 'announcement'] },
  { label: 'To-Do',            path: '/todos',                   keywords: ['todo', 'task', 'checklist'] },
  { label: 'AI Assistant',     path: '/ai',                      keywords: ['ai', 'assistant', 'anomaly', 'forecast'] },
  { label: 'Audit Log',        path: '/audit',                   keywords: ['audit', 'log', 'activity', 'trail'] },
  { label: 'Settings',         path: '/settings',                keywords: ['settings', 'profile', 'password', 'users'] },
];

export default function MobileSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [accountResults, setAccountResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close on outside tap
  useEffect(() => {
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, []);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setAccountResults([]);
      return;
    }

    const q = query.toLowerCase();

    // Module search — instant
    const moduleMatches = MODULE_INDEX.filter((m) =>
      m.label.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.includes(q))
    ).slice(0, 6);
    setResults(moduleMatches);

    // Account search — debounced
    const timer = setTimeout(async () => {
      if (q.length >= 2) {
        try {
          setLoading(true);
          const { data } = await api.get('/accounts?isActive=true');
          if (data.success) {
            const matches = data.data
              .filter((a) => a.code.includes(q) || a.name.toLowerCase().includes(q))
              .slice(0, 4);
            setAccountResults(matches);
          }
        } catch {} finally { setLoading(false); }
      } else {
        setAccountResults([]);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (path) => {
    navigate(path);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setAccountResults([]);
    inputRef.current?.focus();
  };

  const hasResults = results.length > 0 || accountResults.length > 0;

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-app)', borderRadius: 10,
        padding: '10px 14px',
        border: isOpen ? '1.5px solid var(--tech-blue)' : '1px solid var(--border)',
        transition: 'border-color 150ms',
      }}>
        <FiSearch size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search modules, accounts..."
          style={{
            border: 'none', background: 'transparent',
            outline: 'none', fontSize: 14, width: '100%',
            color: 'var(--text-primary)',
          }}
        />
        {query.length > 0 && (
          <button onClick={clearSearch} style={{ color: 'var(--text-muted)', padding: 2, flexShrink: 0, background: 'none', border: 'none' }}>
            <FiX size={16} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && query.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%', left: 0, right: 0,
              marginTop: 6,
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 12px 40px rgba(26,53,96,0.18)',
              zIndex: 9999,
              overflow: 'hidden',
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            {!hasResults && !loading && (
              <div style={{ padding: '16px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                No results for "{query}"
              </div>
            )}

            {results.length > 0 && (
              <>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Pages & Modules
                </div>
                {results.map((item, i) => (
                  <button key={i} onClick={() => handleSelect(item.path)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 14px',
                    background: 'transparent', border: 'none',
                    fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer',
                    textAlign: 'left', fontWeight: 500,
                    borderBottom: '1px solid #F5F5F5',
                  }}>
                    {item.label}
                    <FiArrowRight size={14} color="var(--text-muted)" />
                  </button>
                ))}
              </>
            )}

            {accountResults.length > 0 && (
              <>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderTop: results.length > 0 ? '1px solid var(--border)' : 'none', marginTop: results.length > 0 ? 4 : 0 }}>
                  Accounts
                </div>
                {accountResults.map((acct, i) => (
                  <button key={i} onClick={() => handleSelect('/assets')} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 14px',
                    background: 'transparent', border: 'none',
                    fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer',
                    textAlign: 'left', borderBottom: '1px solid #F5F5F5',
                  }}>
                    <span>
                      <strong style={{ fontFamily: 'monospace', marginRight: 8 }}>{acct.code}</strong>
                      {acct.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8, textTransform: 'capitalize' }}>{acct.type}</span>
                  </button>
                ))}
              </>
            )}

            {loading && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                Searching accounts...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}