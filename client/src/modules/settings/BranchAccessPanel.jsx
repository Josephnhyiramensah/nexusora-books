// client/src/modules/settings/BranchAccessPanel.jsx
//
// Sets which branches a user may see. Mirrors PermissionsPanel: shown inside the
// user edit modal, saves on its own via PUT /users/:id/branch-access.
//   'All branches'      → head-office view, sees and can switch every branch.
//   'Specific branches' → locked to the checked branches; the server forces this
//                         scope regardless of any switcher choice.
import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function BranchAccessPanel({ user, showToast, onSaved }) {
  const [branches, setBranches] = useState([]);
  const [mode, setMode] = useState(user?.branchAccess === 'specific' ? 'specific' : 'all');
  const [selected, setSelected] = useState(() => new Set((user?.branches || []).map(String)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/branches');
        if (data.success) setBranches(data.data || []);
      } catch { /* leave empty */ } finally { setLoading(false); }
    })();
  }, []);

  // Re-sync when the modal switches to a different user.
  useEffect(() => {
    setMode(user?.branchAccess === 'specific' ? 'specific' : 'all');
    setSelected(new Set((user?.branches || []).map(String)));
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (mode === 'specific' && selected.size === 0) {
      showToast('Select at least one branch, or choose "All branches".', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put(`/users/${user._id}/branch-access`, {
        branchAccess: mode,
        branches: mode === 'specific' ? [...selected] : [],
      });
      if (data.success) {
        showToast('Branch access updated.');
        if (onSaved) onSaved();
      } else {
        showToast(data.message || 'Failed to update branch access.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update branch access.', 'error');
    } finally { setSaving(false); }
  };

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };
  const radioRow = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginBottom: 8 };

  const activeBranches = branches.filter((b) => b.isActive || selected.has(String(b._id)));

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Branch Access</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Choose what this user can see. "All branches" gives the head-office view with a branch switcher.
        "Specific branches" locks them to only the branches you pick.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading branches…</p>
      ) : branches.length <= 1 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Only the Head Office branch exists. Add more branches (Settings → Branches) to restrict a user to a specific one.
        </p>
      ) : (
        <>
          <label style={{ ...radioRow, borderColor: mode === 'all' ? 'var(--tech-blue)' : 'var(--border)' }}>
            <input type="radio" name="branchAccessMode" checked={mode === 'all'} onChange={() => setMode('all')} style={{ marginTop: 2 }} />
            <span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>All branches</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>Sees every branch and can switch between them.</span>
            </span>
          </label>

          <label style={{ ...radioRow, borderColor: mode === 'specific' ? 'var(--tech-blue)' : 'var(--border)' }}>
            <input type="radio" name="branchAccessMode" checked={mode === 'specific'} onChange={() => setMode('specific')} style={{ marginTop: 2 }} />
            <span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Specific branches</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>Locked to only the branches checked below.</span>
            </span>
          </label>

          {mode === 'specific' && (
            <div style={{ margin: '10px 0 4px', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <label style={labelStyle}>Allowed branches</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeBranches.map((b) => (
                  <label key={b._id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.has(String(b._id))} onChange={() => toggle(String(b._id))} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--deep-navy)', background: 'var(--nexusora-gold)', borderRadius: 4, padding: '1px 6px' }}>{b.code}</span>
                    <span>{b.name}{b.isHeadOffice ? ' (Head Office)' : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button onClick={save} disabled={saving}
            style={{ marginTop: 14, padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save Branch Access'}
          </button>
        </>
      )}
    </div>
  );
}