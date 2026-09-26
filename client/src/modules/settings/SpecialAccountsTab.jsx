// client/src/modules/settings/SpecialAccountsTab.jsx
//
// Maps each POSTING ROLE to an account in this company's chart.
//
// Why this screen exists: the posting code used to reach for accounts by literal
// code ("1100" for receivables, "2410" for VAT, and so on). That broke silently
// the moment a company renamed or renumbered its chart — a posting either lost a
// leg or landed on the wrong account, while every debit==credit check still
// passed. Postings now ask for a ROLE, and this is where a role is pointed at the
// account this company actually uses.
//
// Leaving a row on "Default" keeps the historical code, so a company that never
// touches this screen behaves exactly as before.
//
// The "Not in chart" flag is the useful part day to day: a red row is a posting
// that would fail or mis-post right now, so this doubles as a health check on the
// chart rather than a settings page nobody opens.

import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheck, FiRefreshCw, FiSave, FiInfo } from 'react-icons/fi';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { useTenant } from '../../context/TenantContext';

const card = {
  background: '#fff', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)', padding: 28, marginBottom: 20,
};
const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };
const select = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff', color: 'var(--text-primary)',
};
const groupTitle = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  margin: '26px 0 12px', paddingBottom: 8, borderBottom: '1px solid var(--border)',
};

export default function SpecialAccountsTab() {
  const { showToast, ToastComponent } = useToast();
  const { updateSettings } = useTenant();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  // draft: role/set -> code string ('' means "use the default")
  const [draft, setDraft] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/accounts/special-accounts');
      if (res.success) {
        setData(res.data);
        const d = {};
        res.data.roles.forEach((r) => { d[r.role] = r.overrideCode || ''; });
        res.data.sets.forEach((s) => { d[s.set] = s.overrideCodes || ''; });
        setDraft(d);
      } else {
        showToast(res.message || 'Could not load special accounts', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not load special accounts', 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // Accounts sorted by code for the dropdowns.
  const accountOptions = useMemo(() => {
    const list = (data?.accounts || []).slice();
    list.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    return list;
  }, [data]);

  // Group roles for rendering, preserving the server's order within each group.
  const grouped = useMemo(() => {
    const out = [];
    (data?.roles || []).forEach((r) => {
      let g = out.find((x) => x.name === r.group);
      if (!g) { g = { name: r.group, roles: [], sets: [] }; out.push(g); }
      g.roles.push(r);
    });
    (data?.sets || []).forEach((s) => {
      let g = out.find((x) => x.name === s.group);
      if (!g) { g = { name: s.group, roles: [], sets: [] }; out.push(g); }
      g.sets.push(s);
    });
    return out;
  }, [data]);

  const brokenCount = (data?.roles || []).filter((r) => !r.ok).length;
  const dirty = useMemo(() => {
    if (!data) return false;
    const same = (a, b) => (a || '') === (b || '');
    return (data.roles || []).some((r) => !same(draft[r.role], r.overrideCode))
      || (data.sets || []).some((s) => !same(draft[s.set], s.overrideCodes));
  }, [draft, data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send non-empty values: an empty string means "back to the default",
      // which the server represents by the key being absent.
      const payload = {};
      Object.keys(draft).forEach((k) => {
        const v = (draft[k] || '').trim();
        if (v) payload[k] = v;
      });
      const { data: res } = await api.put('/accounts/special-accounts', { specialAccounts: payload });
      if (res.success) {
        setData(res.data);
        const d = {};
        res.data.roles.forEach((r) => { d[r.role] = r.overrideCode || ''; });
        res.data.sets.forEach((s) => { d[s.set] = s.overrideCodes || ''; });
        setDraft(d);
        // Keep the cached tenant settings in step so other screens see the change.
        updateSettings({ specialAccounts: res.specialAccounts || payload });
        showToast(res.message || 'Special accounts updated.');
      } else {
        showToast(res.message || 'Save failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    if (!window.confirm('Put every role back to its default account? Nothing is saved until you press Save.')) return;
    const d = {};
    Object.keys(draft).forEach((k) => { d[k] = ''; });
    setDraft(d);
  };

  if (loading) {
    return <div style={card}><p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Loading special accounts…</p></div>;
  }
  if (!data) {
    return <div style={card}><p style={{ fontSize: 14, color: 'var(--danger)', margin: 0 }}>Could not load special accounts.</p></div>;
  }

  return (
    <div style={{ maxWidth: 940 }}>
      {ToastComponent}

      <div style={card}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: 'var(--deep-navy)', margin: '0 0 8px' }}>
          Special Accounts
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 4px' }}>
          Each posting role below is pointed at an account in this company's chart. Postings ask for the
          role, never a fixed account number — so if you rename or renumber your chart, you change it
          here instead of anything breaking quietly. Leave a row on <strong>Default</strong> to keep the
          standard account.
        </p>

        {brokenCount > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', marginTop: 16 }}>
            <FiAlertTriangle size={16} style={{ color: '#B91C1C', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.55 }}>
              <strong>{brokenCount} role{brokenCount === 1 ? '' : 's'} point at an account that isn't in this chart.</strong>{' '}
              Any posting that needs one of those will fail or fall back. Map them below, or add the
              missing account under Settings → Chart Maintenance.
            </div>
          </div>
        )}
        {brokenCount === 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-sm)', marginTop: 16, fontSize: 13, color: '#065F46' }}>
            <FiCheck size={15} /> Every role resolves to an account in this chart.
          </div>
        )}

        {(data.warnings || []).map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', marginTop: 10 }}>
            <FiInfo size={15} style={{ color: '#92400E', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.55 }}>{w.message}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        {grouped.map((g) => (
          <div key={g.name}>
            <div style={groupTitle}>{g.name}</div>

            {g.roles.map((r) => {
              const chosen = draft[r.role] || '';
              const effective = chosen || r.defaultCode;
              const stillMissing = !(data.accounts || []).some((a) => String(a.code) === String(effective));
              return (
                <div key={r.role} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.1fr) minmax(220px, 1.4fr)', gap: 16, alignItems: 'start', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div>
                    <label style={{ ...label, marginBottom: 2 }}>{r.label}</label>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{r.used}</div>
                  </div>
                  <div>
                    <select
                      style={{ ...select, borderColor: stillMissing ? '#FCA5A5' : 'var(--border)' }}
                      value={chosen}
                      onChange={(e) => setDraft((p) => ({ ...p, [r.role]: e.target.value }))}
                    >
                      <option value="">
                        Default — {r.defaultCode}
                      </option>
                      {accountOptions.map((a) => (
                        <option key={a._id} value={a.code}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11.5, marginTop: 4, color: stillMissing ? '#B91C1C' : 'var(--text-muted)' }}>
                      {stillMissing
                        ? `Code ${effective} is not in this chart`
                        : `Posts to ${effective}`}
                    </div>
                  </div>
                </div>
              );
            })}

            {g.sets.map((s) => (
              <div key={s.set} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.1fr) minmax(220px, 1.4fr)', gap: 16, alignItems: 'start', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div>
                  <label style={{ ...label, marginBottom: 2 }}>{s.label}</label>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{s.used}</div>
                </div>
                <div>
                  <input
                    style={select}
                    value={draft[s.set] || ''}
                    placeholder={`Default — ${(s.defaultCodes || []).join(', ')}`}
                    onChange={(e) => setDraft((p) => ({ ...p, [s.set]: e.target.value }))}
                  />
                  <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-muted)' }}>
                    Comma-separated account codes. Leave blank for the default.
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 28px', borderRadius: 'var(--radius-sm)',
            background: (saving || !dirty) ? 'var(--border)' : 'var(--nexusora-gold)',
            color: (saving || !dirty) ? 'var(--text-muted)' : 'var(--deep-navy)',
            fontSize: 14, fontWeight: 600, border: 'none',
            cursor: (saving || !dirty) ? 'not-allowed' : 'pointer',
          }}
        >
          <FiSave size={15} /> {saving ? 'Saving…' : 'Save Special Accounts'}
        </button>
        <button
          onClick={resetAll}
          disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <FiRefreshCw size={14} /> Reset all to default
        </button>
        {dirty && <span style={{ fontSize: 12.5, color: '#B45309' }}>Unsaved changes</span>}
      </div>
    </div>
  );
}