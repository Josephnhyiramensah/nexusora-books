// client/src/modules/settings/PayrollRatesEditor.jsx
//
// Editor for a tenant's PAYE/SSNIT rate override. Rendered inside the tenant
// Settings page, visible only to super_admin / admin. When the tenant has no
// override, payroll uses the platform global default (or the built-in fallback).
//
// Saving posts settings.payrollRates to /api/auth/company-settings (already
// guarded to super_admin/admin on the backend). Clearing the override reverts
// the tenant to the inherited rates.
import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiRotateCcw, FiInfo } from 'react-icons/fi';

const box = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 20, marginBottom: 16 };
const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6B7280)', marginBottom: 6 };
const input = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 14, boxSizing: 'border-box' };
const gold = { padding: '10px 22px', borderRadius: 8, background: 'var(--nexusora-gold, #C9A227)', color: 'var(--deep-navy, #1A3560)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' };
const ghost = { padding: '9px 16px', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary, #6B7280)', fontSize: 13, fontWeight: 500, border: '1px solid var(--border, #D1D5DB)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

// Convert a stored rate (0.055) to a percent string for display (5.5)
const toPct = (r) => (r === null || r === undefined || r === '') ? '' : String(+(Number(r) * 100).toFixed(4));
const fromPct = (p) => (p === '' || p === null || p === undefined) ? '' : Number(p) / 100;

export default function PayrollRatesEditor({ showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState('default');      // where the ACTIVE rates come from
  const [hasOverride, setHasOverride] = useState(false);
  const [label_, setLabel] = useState('');
  const [ssnitEmp, setSsnitEmp] = useState('');          // percent strings in the UI
  const [ssnitEmr, setSsnitEmr] = useState('');
  const [bands, setBands] = useState([]);                // [{ upTo:'', ratePct:'' }]

  // Load current effective rates + whether this tenant has its own override.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/payroll/rates', { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        const data = await res.json();
        if (!alive) return;
        const eff = data?.data || {};
        setSource(eff.source || 'default');
        setHasOverride(eff.source === 'tenant');
        setLabel(eff.label || '');
        setSsnitEmp(toPct(eff.ssnit?.employeeRate));
        setSsnitEmr(toPct(eff.ssnit?.employerRate));
        setBands((eff.payeBands || []).map((b) => ({ upTo: (b.upTo === null || !Number.isFinite(b.upTo)) ? '' : String(b.upTo), ratePct: toPct(b.rate) })));
      } catch (e) {
        showToast?.('Could not load payroll rates', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  const addBand = () => setBands((b) => [...b, { upTo: '', ratePct: '' }]);
  const removeBand = (i) => setBands((b) => b.filter((_, idx) => idx !== i));
  const setBand = (i, field, val) => setBands((b) => b.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const save = async () => {
    // Build payload. Empty upTo on the LAST band = "and above" (null).
    const payeBands = bands
      .filter((b) => b.ratePct !== '')
      .map((b, i, arr) => ({
        upTo: (b.upTo === '' ) ? null : Number(b.upTo),
        rate: fromPct(b.ratePct),
      }));
    const payload = {
      payrollRates: {
        label: label_ || 'Custom (this company)',
        ssnit: { employeeRate: fromPct(ssnitEmp), employerRate: fromPct(ssnitEmr) },
        payeBands,
        updatedAt: new Date().toISOString(),
      },
    };
    setSaving(true);
    try {
      const res = await fetch('/api/auth/company-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ settings: payload }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Save failed');
      setHasOverride(true); setSource('tenant');
      showToast?.('Payroll rates saved for this company', 'success');
    } catch (e) {
      showToast?.(e.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const clearOverride = async () => {
    if (!window.confirm('Remove this company\u2019s custom rates and use the platform default instead?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/auth/company-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ settings: { payrollRates: null } }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed');
      showToast?.('Reverted to the platform default rates', 'success');
      // reload to show inherited values
      window.location.reload();
    } catch (e) {
      showToast?.(e.message || 'Failed', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 24, color: '#6B7280' }}>Loading payroll rates\u2026</div>;

  const sourceLabel = source === 'tenant' ? 'This company\u2019s custom rates'
    : source === 'global' ? 'Platform default (set centrally)'
    : 'Built-in default (GRA 2026)';

  return (
    <div>
      <div style={{ ...box, background: 'var(--surface-alt, #F9FAFB)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <FiInfo size={18} style={{ color: '#2563EB', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #4B5563)', lineHeight: 1.5 }}>
          Ghana PAYE and SSNIT rates are set by the GRA and can change. Payroll currently uses:{' '}
          <strong style={{ color: 'var(--text-primary, #111827)' }}>{sourceLabel}</strong>.
          {' '}Set your own values below only if you need to override the platform default. Historical payslips keep the rates they were run with.
        </div>
      </div>

      <div style={box}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #111827)', marginTop: 0, marginBottom: 16 }}>SSNIT Contribution Rates</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Employee (%)</label>
            <input style={input} type="number" step="0.1" value={ssnitEmp} onChange={(e) => setSsnitEmp(e.target.value)} placeholder="5.5" />
          </div>
          <div>
            <label style={label}>Employer (%)</label>
            <input style={input} type="number" step="0.1" value={ssnitEmr} onChange={(e) => setSsnitEmr(e.target.value)} placeholder="13" />
          </div>
        </div>
      </div>

      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #111827)', margin: 0 }}>PAYE Tax Bands (monthly)</h3>
          <button onClick={addBand} style={ghost}><FiPlus size={14} /> Add band</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary, #6B7280)', marginTop: 0, marginBottom: 12 }}>
          Each band taxes income up to its limit at the given rate. Leave the last band\u2019s limit empty for \u201Cand above\u201D.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 10, marginBottom: 8 }}>
          <span style={label}>Up to (GHS)</span>
          <span style={label}>Rate (%)</span>
          <span />
        </div>
        {bands.map((b, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <input style={input} type="number" value={b.upTo} onChange={(e) => setBand(i, 'upTo', e.target.value)} placeholder={i === bands.length - 1 ? 'and above' : 'e.g. 600'} />
            <input style={input} type="number" step="0.1" value={b.ratePct} onChange={(e) => setBand(i, 'ratePct', e.target.value)} placeholder="e.g. 5" />
            <button onClick={() => removeBand(i)} title="Remove" style={{ ...ghost, padding: 8, justifyContent: 'center', color: '#DC2626' }}><FiTrash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div style={box}>
        <label style={label}>Label (for payslips / records)</label>
        <input style={input} value={label_} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. GRA 2026 monthly bands" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={{ ...gold, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving\u2026' : 'Save rates for this company'}</button>
        {hasOverride && (
          <button onClick={clearOverride} disabled={saving} style={ghost}><FiRotateCcw size={14} /> Use platform default</button>
        )}
      </div>
    </div>
  );
}
