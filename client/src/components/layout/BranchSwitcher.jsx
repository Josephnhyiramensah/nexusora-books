// client/src/components/layout/BranchSwitcher.jsx
//
// Compact top-bar dropdown to choose the active branch. VISIBILITY FOLLOWS THE
// USER'S OWN ACCESS, not the company's total branch count:
//   • branchAccess 'all'                  → every active branch (head office).
//   • branchAccess 'specific', 2+ branches → only those branches (regional view),
//                                            plus a "My branches (combined)" roll-up.
//   • branchAccess 'specific', 1 branch    → NOTHING renders — a branch staffer is
//                                            silently locked to their branch.
// The server is the real gate (a restricted user's requests are scoped/refused
// regardless). This just stops showing a control they can't use.

import { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';

export default function BranchSwitcher({ compact }) {
  const { branches, activeBranch, setActiveBranch } = useBranch();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // What this user is allowed to see. Missing field → treat as 'all' (legacy).
  const access = user?.branchAccess || 'all';
  const allowedIds = new Set((user?.branches || []).map(String));

  // The branches this user may actually view.
  //   'all'      → every active branch
  //   'specific' → only their allowed ones (kept even if just deactivated so the
  //                current selection still resolves to a label)
  const visible = access === 'specific'
    ? branches.filter((b) => allowedIds.has(String(b._id)))
    : branches.filter((b) => b.isActive || String(b._id) === String(activeBranch));

  // A user who can see 0 or 1 branch has nothing to switch — render nothing.
  if (visible.length <= 1) return null;

  // 'all'-access users get a true "All branches" consolidated option. Restricted
  // users get "My branches (combined)" — a roll-up of only the branches they hold.
  const allLabel = access === 'specific'
    ? { name: 'My branches', code: 'MINE' }
    : { name: 'All branches', code: 'ALL' };

  const current = activeBranch === 'all'
    ? allLabel
    : (visible.find((b) => String(b._id) === String(activeBranch)) || allLabel);

  const choose = (id) => {
    setActiveBranch(id);
    setOpen(false);
    window.location.reload();
  };

  const pill = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: compact ? '5px 8px' : '6px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-app)',
    border: '1px solid var(--border)',
    cursor: 'pointer', flexShrink: 0,
    maxWidth: compact ? 130 : 190,
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOpen((o) => !o)} style={pill} title="Switch branch">
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--deep-navy)',
          background: 'var(--nexusora-gold)', borderRadius: 4, padding: '1px 6px', flexShrink: 0,
        }}>
          {current.code || 'HO'}
        </span>
        {!compact && (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {current.name}
          </span>
        )}
        <FiChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms', flexShrink: 0 }} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 8,
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
              minWidth: 220, padding: '6px 0', zIndex: 200, maxHeight: 320, overflowY: 'auto',
            }}
          >
            <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 16px 4px', margin: 0 }}>View branch</p>

            {/* Combined view — all (head office) or "my branches" (regional). */}
            <button onClick={() => choose('all')} style={rowStyle(activeBranch === 'all')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={codeTag}>{allLabel.code}</span>
                <span style={{ fontSize: 14 }}>{allLabel.name}</span>
              </span>
              {activeBranch === 'all' && <FiCheck size={15} style={{ color: 'var(--success)' }} />}
            </button>

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            {visible.map((b) => {
              const isSel = String(b._id) === String(activeBranch);
              return (
                <button key={b._id} onClick={() => choose(b._id)} style={rowStyle(isSel)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={codeTag}>{b.code}</span>
                    <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                  </span>
                  {isSel && <FiCheck size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const rowStyle = (active) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  width: '100%', padding: '10px 16px', border: 'none',
  background: active ? 'var(--bg-app)' : 'transparent',
  cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
});
const codeTag = {
  fontSize: 11, fontWeight: 700, color: 'var(--deep-navy)',
  background: 'var(--nexusora-gold)', borderRadius: 4, padding: '1px 6px', flexShrink: 0, minWidth: 30, textAlign: 'center',
};