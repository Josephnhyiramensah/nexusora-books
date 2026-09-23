// client/src/context/BranchContext.jsx
//
// Holds the list of branches and the currently-selected one. The selection is
// persisted to localStorage and read by the api interceptor, which attaches it
// as the X-Branch header on every request — so the whole app filters to the
// chosen branch with no per-page changes.
//
// 'all' (or null) means the consolidated / all-branches view. The server is the
// authority: a branch-restricted user's selection is ignored server-side and
// forced to their allowed branch(es), so this is purely a convenience for
// head-office users who may see everything.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'active_branch';           // stored branch _id, or absent for "all"
const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBranch, setActiveBranchState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'all'; } catch { return 'all'; }
  });

  // Persist + expose a setter. 'all' clears the header (consolidated).
  const setActiveBranch = useCallback((branchId) => {
    const val = branchId && branchId !== 'all' ? branchId : 'all';
    setActiveBranchState(val);
    try {
      if (val === 'all') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, val);
    } catch { /* ignore storage errors */ }
  }, []);

  // Load branches once a user is present (needs auth). Anonymous → skip.
  useEffect(() => {
    let cancelled = false;
    if (!user) { setBranches([]); setLoading(false); return () => {}; }
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/branches');
        if (!cancelled && data.success) {
          const list = data.data || [];
          setBranches(list);
          // If the stored selection no longer exists (deactivated/deleted), or the
          // user only has one branch, fall back to a sane default.
          const stored = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
          if (stored && !list.some((b) => String(b._id) === String(stored))) {
            setActiveBranch('all');
          }
        }
      } catch {
        if (!cancelled) setBranches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, setActiveBranch]);

  const value = {
    branches,
    activeBranch,          // 'all' | branchId
    setActiveBranch,
    loading,
    // Convenience: the active branch object (or null for 'all').
    activeBranchObj: activeBranch === 'all' ? null : branches.find((b) => String(b._id) === String(activeBranch)) || null,
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    // Safe fallback if used outside the provider — behaves as consolidated.
    return { branches: [], activeBranch: 'all', setActiveBranch: () => {}, loading: false, activeBranchObj: null };
  }
  return ctx;
}

// The localStorage key the api interceptor reads. Exported so there is a single
// source of truth for the key name.
export { STORAGE_KEY as BRANCH_STORAGE_KEY };