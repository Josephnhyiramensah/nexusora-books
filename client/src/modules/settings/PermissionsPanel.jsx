// client/src/modules/settings/PermissionsPanel.jsx
// Grant or revoke extra access for one user, on top of what their role already
// allows. Grants are additive — anything the role implies is shown ticked and
// locked, because removing it here would be misleading.

import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function PermissionsPanel({ user, showToast, onSaved }) {
  const [catalogue, setCatalogue] = useState([]);
  const [granted, setGranted] = useState(user?.permissions || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/users/permissions/catalogue')
      .then(({ data }) => { if (data.success) setCatalogue(data.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { setGranted(user?.permissions || []); }, [user]);

  if (!user) return null;

  const toggle = (key) => {
    setGranted((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/users/${user._id}/permissions`, { permissions: granted });
      if (data.success) {
        showToast('Permissions updated');
        if (onSaved) onSaved();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 4 }}>Additional Access</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Grant this user access to areas their role does not normally include.
      </p>

      {catalogue.map((p) => {
        const byRole = p.impliedBy.includes(user.role);
        const checked = byRole || granted.includes(p.key);
        return (
          <label key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', cursor: byRole ? 'not-allowed' : 'pointer', opacity: byRole ? 0.6 : 1 }}>
            <input type="checkbox" checked={checked} disabled={byRole}
              onChange={() => toggle(p.key)} style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
            <span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</span>
              {byRole && <span style={{ fontSize: 11, color: 'var(--success)', marginLeft: 8 }}>included in role</span>}
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{p.description}</span>
            </span>
          </label>
        );
      })}

      <button type="button" onClick={save} disabled={saving}
        style={{ marginTop: 14, padding: '9px 20px', borderRadius: 'var(--radius-sm)', background: 'var(--tech-blue)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save Permissions'}
      </button>
    </div>
  );
}