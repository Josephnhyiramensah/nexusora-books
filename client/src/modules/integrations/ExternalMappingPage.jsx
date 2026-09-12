// client/src/modules/integrations/ExternalMappingPage.jsx
// Admin UI to configure how an external system's raw data maps into Books
// vouchers: field map, account map, and type map. Same philosophy as the bank
// reconciliation column-mapper, applied to the API integration.
import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiSave } from 'react-icons/fi';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';

const VOUCHER_TYPES = ['payment','receipt','contra','transfer','journal','purchase','sales','debit_note','credit_note'];

// Books voucher fields the admin maps external field names onto.
const FIELDS = [
  ['externalId', 'Unique ID (for dedup) *'],
  ['voucherType', 'Transaction type'],
  ['date', 'Date'],
  ['amount', 'Amount *'],
  ['narration', 'Narration'],
  ['reference', 'Reference'],
  ['partyName', 'Party (payee)'],
  ['mode', 'Payment mode'],
  ['debitAccount', 'Debit account (their id) *'],
  ['creditAccount', 'Credit account (their id) *'],
];

export default function ExternalMappingPage() {
  const { showToast, ToastComponent } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [m, setM] = useState({
    source: 'kgr_php_gold', label: '', fixedVoucherType: '',
    autopost: true, active: true,
    fieldMap: {}, accountMap: [], typeMap: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const [mapRes, acctRes] = await Promise.all([
          api.get('/external-mappings'),
          api.get('/accounts'),
        ]);
        if (acctRes.data.success) setAccounts(acctRes.data.data.filter((a) => a.isActive !== false));
        if (mapRes.data.success && mapRes.data.data.length) {
          const first = mapRes.data.data[0];
          setM({
            _id: first._id, source: first.source, label: first.label || '',
            fixedVoucherType: first.fixedVoucherType || '',
            autopost: first.autopost !== false, active: first.active !== false,
            fieldMap: first.fieldMap || {}, accountMap: first.accountMap || [], typeMap: first.typeMap || [],
          });
        }
      } catch { showToast('Could not load mapping', 'error'); }
      finally { setLoading(false); }
    })();
  }, []);

  const setField = (k, v) => setM((s) => ({ ...s, fieldMap: { ...s.fieldMap, [k]: v } }));
  const addAcct = () => setM((s) => ({ ...s, accountMap: [...s.accountMap, { externalAccount: '', booksCode: '', label: '' }] }));
  const setAcct = (i, k, v) => setM((s) => ({ ...s, accountMap: s.accountMap.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const delAcct = (i) => setM((s) => ({ ...s, accountMap: s.accountMap.filter((_, idx) => idx !== i) }));
  const addType = () => setM((s) => ({ ...s, typeMap: [...s.typeMap, { externalType: '', voucherType: 'payment' }] }));
  const setType = (i, k, v) => setM((s) => ({ ...s, typeMap: s.typeMap.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const delType = (i) => setM((s) => ({ ...s, typeMap: s.typeMap.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!m.source) { showToast('Source key is required', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/external-mappings', m);
      if (data.success) { showToast('Mapping saved', 'success'); if (data.data?._id) setM((s) => ({ ...s, _id: data.data._id })); }
      else showToast(data.message || 'Save failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6B7280)', marginBottom: 6 };
  const input = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 14, boxSizing: 'border-box' };
  const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 20, marginBottom: 16 };
  const btn = { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

  if (loading) return <div style={{ padding: 24, color: '#6B7280' }}>Loading mapping…</div>;

  return (
    <div style={{ maxWidth: 860 }}>
      {ToastComponent}
      <div style={{ ...card, background: 'var(--surface-alt, #F2F6FC)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4B5563)', lineHeight: 1.5 }}>
          Configure how an external system (e.g. the KGR gold app) sends data into Nexusora Books.
          Map its field names, its accounts, and its transaction types — once. After that, every
          record it posts to <code>/external/v1/vouchers/mapped</code> is translated automatically into a voucher.
        </p>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><label style={label}>Source key *</label><input style={input} value={m.source} onChange={(e) => setM({ ...m, source: e.target.value })} placeholder="kgr_php_gold" /></div>
          <div><label style={label}>Friendly name</label><input style={input} value={m.label} onChange={(e) => setM({ ...m, label: e.target.value })} placeholder="KGR Gold (PHP)" /></div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={m.autopost} onChange={(e) => setM({ ...m, autopost: e.target.checked })} /> Auto-post on import
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={m.active} onChange={(e) => setM({ ...m, active: e.target.checked })} /> Active
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>Fixed type (optional):</span>
            <select style={{ ...input, width: 'auto' }} value={m.fixedVoucherType} onChange={(e) => setM({ ...m, fixedVoucherType: e.target.value })}>
              <option value="">— use type map —</option>
              {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Field map */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', marginTop: 0 }}>1. Field Mapping</h3>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0 }}>Enter the external system's field name that supplies each Books field.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {FIELDS.map(([key, lbl]) => (
            <div key={key}>
              <label style={label}>{lbl}</label>
              <input style={input} value={m.fieldMap[key] || ''} onChange={(e) => setField(key, e.target.value)} placeholder={`their field for ${key}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Account map */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>2. Account Mapping</h3>
          <button style={btn} onClick={addAcct}><FiPlus size={14} /> Add</button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0 }}>Map each of their account IDs to a Books account code.</p>
        {m.accountMap.length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF' }}>No account mappings yet.</p>}
        {m.accountMap.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <input style={input} value={r.externalAccount} onChange={(e) => setAcct(i, 'externalAccount', e.target.value)} placeholder="their acct id (e.g. 45)" />
            <select style={input} value={r.booksCode} onChange={(e) => setAcct(i, 'booksCode', e.target.value)}>
              <option value="">Books account…</option>
              {accounts.map((a) => <option key={a._id} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
            <input style={input} value={r.label || ''} onChange={(e) => setAcct(i, 'label', e.target.value)} placeholder="note (optional)" />
            <button style={{ ...btn, padding: 8, color: '#DC2626', justifyContent: 'center' }} onClick={() => delAcct(i)}><FiTrash2 size={14} /></button>
          </div>
        ))}
      </div>

      {/* Type map */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>3. Type Mapping</h3>
          <button style={btn} onClick={addType}><FiPlus size={14} /> Add</button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0 }}>Map their transaction type values to Books voucher types. (Skip if using a fixed type above.)</p>
        {m.typeMap.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <input style={input} value={r.externalType} onChange={(e) => setType(i, 'externalType', e.target.value)} placeholder="their type (e.g. payment)" />
            <select style={input} value={r.voucherType} onChange={(e) => setType(i, 'voucherType', e.target.value)}>
              {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button style={{ ...btn, padding: 8, color: '#DC2626', justifyContent: 'center' }} onClick={() => delType(i)}><FiTrash2 size={14} /></button>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        style={{ padding: '11px 24px', borderRadius: 8, border: 'none', background: 'var(--nexusora-gold, #FD9C09)', color: 'var(--deep-navy, #012158)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <FiSave size={15} /> {saving ? 'Saving…' : 'Save Mapping'}
      </button>
    </div>
  );
}
