// client/src/components/common/SmartAccountSelect.jsx
// Smart account selector with search-as-you-type, code/name autocomplete

import { useState, useRef, useEffect } from 'react';

export default function SmartAccountSelect({ accounts = [], value, onChange, placeholder = 'Search by code or name...' }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Find the selected account for display
  const selectedAccount = accounts.find((a) => a._id === value);

  // Filter accounts based on query
  const filtered = query.trim()
    ? accounts.filter((a) =>
        a.code.toLowerCase().includes(query.toLowerCase()) ||
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.type.toLowerCase().includes(query.toLowerCase()) ||
        (a.category || '').toLowerCase().includes(query.toLowerCase())
      )
    : accounts;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  const handleSelect = (account) => {
    onChange(account._id, account);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    setQuery('');
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const clearSelection = () => {
    onChange('', null);
    setQuery('');
    inputRef.current?.focus();
  };

  // Type badge colors
  const typeBadge = (type) => {
    const colors = {
      asset: { bg: '#DBEAFE', text: '#1E40AF' },
      liability: { bg: '#FEE2E2', text: '#991B1B' },
      equity: { bg: '#F3E8FF', text: '#6B21A8' },
      revenue: { bg: '#D1FAE5', text: '#065F46' },
      cogs: { bg: '#FEF3C7', text: '#92400E' },
      expense: { bg: '#FFEDD5', text: '#9A3412' },
    };
    return colors[type] || { bg: '#F3F4F6', text: '#6B7280' };
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Display selected or search input */}
      {selectedAccount && !isOpen ? (
        <div
          onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: 12,
            background: '#fff', cursor: 'pointer',
            transition: 'border-color var(--transition-fast)',
          }}
        >
          <span>
            <strong style={{ fontFamily: 'monospace', marginRight: 6 }}>{selectedAccount.code}</strong>
            {selectedAccount.name}
          </span>
          <button onClick={(e) => { e.stopPropagation(); clearSelection(); }}
            style={{ color: 'var(--text-muted)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>
            ×
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '8px 12px',
            border: `1px solid ${isOpen ? 'var(--tech-blue)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)', fontSize: 12,
            color: 'var(--text-primary)', outline: 'none',
            transition: 'border-color var(--transition-fast)',
          }}
        />
      )}

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: 4, background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 260, overflowY: 'auto', zIndex: 500,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No accounts match "{query}"
            </div>
          ) : (
            filtered.map((acct, i) => {
              const badge = typeBadge(acct.type);
              return (
                <div
                  key={acct._id}
                  onClick={() => handleSelect(acct)}
                  onMouseEnter={() => setHighlightIndex(i)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px', cursor: 'pointer', fontSize: 12,
                    background: i === highlightIndex ? '#F0F7FF' : 'transparent',
                    borderBottom: '1px solid #F5F5F5',
                    transition: 'background 100ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                      color: 'var(--deep-navy)', minWidth: 42,
                    }}>{acct.code}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{acct.name}</span>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                    background: badge.bg, color: badge.text, textTransform: 'capitalize',
                  }}>{acct.type}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}