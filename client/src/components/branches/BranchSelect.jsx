// client/src/components/branches/BranchSelect.jsx
//
// The WRITE-side branch control — the create-form counterpart to BranchSwitcher.
// BranchSwitcher chooses what you VIEW (and offers an "all/combined" roll-up);
// this chooses the branch a NEW record is STAMPED with, so there is no "all"
// option — a transaction belongs to exactly one branch.
//
// Its access logic mirrors the server's resolveWriteBranch so the form and the
// API agree on the same rule:
//   • options = active branches the user may write to
//       ('all' access → every active branch; 'specific' → granted ∩ active)
//   • ≤ 1 writable branch → the field is HIDDEN; the server auto-resolves it
//   • 2+ writable branches → the field is SHOWN and a choice is REQUIRED,
//       pre-filled from the top-bar branch, or left empty on "All branches"
//
// useBranchField() exposes that state so a form can gate its own layout and
// block save; <BranchSelect> is the ready-made field for the common case.

import { useEffect, useRef } from 'react';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';

// Shared access logic — the single source of truth for the branch field's state.
export function useBranchField() {
  const { branches, activeBranch } = useBranch();
  const { user } = useAuth();

  const access = user?.branchAccess || 'all';
  const grantedIds = new Set((user?.branches || []).map(String));
  const active = (branches || []).filter((b) => b.isActive);

  // Branches this user may WRITE to (mirrors the server's writableIds).
  const options = access === 'specific'
    ? active.filter((b) => grantedIds.has(String(b._id)))
    : active;

  const visible = options.length > 1;                // one or none → server resolves it
  const onAll = String(activeBranch) === 'all';
  const defaultBranch = onAll
    ? ''                                             // "All branches" → force a choice
    : (options.find((b) => String(b._id) === String(activeBranch))?._id || '');

  // When shown, a choice is mandatory (the default satisfies it when present).
  return { visible, required: visible, options, defaultBranch, onAll };
}

export default function BranchSelect({ value, onChange, labelText = 'Branch' }) {
  const { visible, options, defaultBranch } = useBranchField();

  // Seed the top-bar branch once, so a user viewing their own branch doesn't have
  // to re-pick it. On "All branches" defaultBranch is '' — left empty on purpose.
  const seeded = useRef(false);
  useEffect(() => {
    if (visible && !seeded.current && !value && defaultBranch) {
      seeded.current = true;
      onChange(defaultBranch);
    }
  }, [visible, value, defaultBranch, onChange]);

  if (!visible) return null;

  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6B7280)', marginBottom: 6 };
  const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 14, boxSizing: 'border-box', background: '#fff', cursor: 'pointer' };

  return (
    <div>
      <label style={label}>{labelText} <span style={{ color: '#DC2626' }}>*</span></label>
      <select style={input} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Select branch…</option>
        {options.map((b) => (
          <option key={b._id} value={b._id}>{b.code ? `${b.code} — ${b.name}` : b.name}</option>
        ))}
      </select>
      {!value && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary, #6B7280)', margin: '6px 0 0' }}>
          Choose the branch this transaction belongs to.
        </p>
      )}
    </div>
  );
}