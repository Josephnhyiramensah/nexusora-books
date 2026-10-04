// client/src/modules/integrations/ExternalMappingPage.jsx
//
// Integration manager: list all configured external-system integrations, and
// create / edit / delete each. Each integration defines how one external
// system's raw data maps into Books vouchers (field map, account map, type map).
// Generic — works for any external system, not tied to any single one.
import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiSave, FiEdit2, FiArrowLeft, FiLink } from 'react-icons/fi';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';

const VOUCHER_TYPES = ['payment','receipt','contra','transfer','journal','purchase','sales','debit_note','credit_note'];

const FIELDS = [
  ['externalId', 'Unique ID (for dedup)', true],
  ['voucherType', 'Transaction type', false],
  ['date', 'Date', false],
  ['amount', 'Amount', true],
  ['narration', 'Narration', false],
  ['reference', 'Reference', false],
  ['partyName', 'Party name', false],
  ['partyId', 'Person ID (ledger key)', false],
  ['mode', 'Payment mode', false],
  ['debitAccount', 'Debit account / ledger', true],
  ['creditAccount', 'Credit account / ledger', true],
  ['debitGroup', 'Debit ledger group', false],
  ['creditGroup', 'Credit ledger group', false],
  ['debitName', 'Debit ledger name', false],
  ['creditName', 'Credit ledger name', false],
  ['companyId', 'Company id', false],
  ['branch', 'Branch', false],
];

const blank = () => ({
  source: '', label: '', fixedVoucherType: '', fixedBranch: '', autopost: true, active: true,
  partyControlCode: '1100', partyCodePrefix: 'SL-',
  partyGroups: '4,7', partyPayableGroups: '7', partyPayableControlCode: '2000', sourceCompanyId: '',
  fieldMap: {}, accountMap: [], typeMap: [], branchMap: [],
});

export default function ExternalMappingPage() {
  const { showToast, ToastComponent } = useToast();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [editing, setEditing] = useState(null); // null = list view; object = editor
  const [saving, setSaving] = useState(false);

  const loadList = async () => {
    try {
      const { data } = await api.get('/external-mappings');
      if (data.success) setList(data.data);
    } catch { showToast('Could not load integrations', 'error'); }
  };

  useEffect(() => {
    (async () => {
      try {
        const acctRes = await api.get('/accounts');
        if (acctRes.data.success) setAccounts(acctRes.data.data.filter((a) => a.isActive !== false));
        try {
          const brRes = await api.get('/branches');
          if (brRes.data.success) setBranches(brRes.data.data.filter((b) => b.isActive !== false));
        } catch { /* branches optional; leave empty */ }
        await loadList();
      } finally { setLoading(false); }
    })();
  }, []);

  // ── styles ──
  const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 20, marginBottom: 16 };
  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6B7280)', marginBottom: 6 };
  const input = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 14, boxSizing: 'border-box' };
  const goldBtn = { padding: '11px 22px', borderRadius: 8, border: 'none', background: 'var(--nexusora-gold, #FD9C09)', color: 'var(--deep-navy, #012158)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
  const ghostBtn = { padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

  if (loading) return <div style={{ padding: 24, color: '#6B7280' }}>Loading integrations…</div>;

  // ── LIST VIEW ──
  if (!editing) {
    return (
      <div style={{ maxWidth: 860 }}>
        {ToastComponent}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>Integrations</h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Connect external systems that send transactions into Nexusora Books.</p>
          </div>
          <button style={goldBtn} onClick={() => setEditing(blank())}><FiPlus size={15} /> New Integration</button>
        </div>

        {list.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
            <FiLink size={28} style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 14 }}>No integrations configured yet.</p>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>Create one to let an external system post transactions into your books.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, overflow: 'hidden' }}>
            {list.map((it, i) => (
              <div key={it._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderTop: i ? '1px solid var(--border, #F0F0F0)' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #111827)' }}>{it.label || it.source}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    <code>{it.source}</code> · {it.accountMap?.length || 0} accounts mapped · {it.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={ghostBtn} onClick={() => setEditing({ ...blank(), ...it, fieldMap: it.fieldMap || {}, accountMap: it.accountMap || [], typeMap: it.typeMap || [], branchMap: it.branchMap || [] })}><FiEdit2 size={13} /> Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── EDITOR VIEW ──
  const m = editing;
  const setM = (patch) => setEditing((s) => ({ ...s, ...patch }));
  const setField = (k, v) => setEditing((s) => ({ ...s, fieldMap: { ...s.fieldMap, [k]: v } }));
  const addAcct = () => setEditing((s) => ({ ...s, accountMap: [...s.accountMap, { externalAccount: '', booksCode: '', label: '' }] }));
  const setAcct = (i, k, v) => setEditing((s) => ({ ...s, accountMap: s.accountMap.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const delAcct = (i) => setEditing((s) => ({ ...s, accountMap: s.accountMap.filter((_, idx) => idx !== i) }));
  const addType = () => setEditing((s) => ({ ...s, typeMap: [...s.typeMap, { externalType: '', voucherType: 'payment' }] }));
  const setType = (i, k, v) => setEditing((s) => ({ ...s, typeMap: s.typeMap.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const delType = (i) => setEditing((s) => ({ ...s, typeMap: s.typeMap.filter((_, idx) => idx !== i) }));
  const addBranch = () => setEditing((s) => ({ ...s, branchMap: [...(s.branchMap || []), { externalBranch: '', booksBranchCode: '', label: '' }] }));
  const setBranch = (i, k, v) => setEditing((s) => ({ ...s, branchMap: s.branchMap.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const delBranch = (i) => setEditing((s) => ({ ...s, branchMap: s.branchMap.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!m.source.trim()) { showToast('A source key is required', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/external-mappings', m);
      if (data.success) { showToast('Integration saved', 'success'); await loadList(); setEditing(null); }
      else showToast(data.message || 'Save failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!m._id) { setEditing(null); return; }
    if (!window.confirm('Delete this integration? External systems using it will stop importing.')) return;
    setSaving(true);
    try {
      const { data } = await api.delete(`/external-mappings/${m._id}`);
      if (data.success) { showToast('Integration deleted', 'success'); await loadList(); setEditing(null); }
      else showToast(data.message || 'Delete failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Delete failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {ToastComponent}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button style={ghostBtn} onClick={() => setEditing(null)}><FiArrowLeft size={14} /> Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>{m._id ? 'Edit Integration' : 'New Integration'}</h1>
      </div>

      <div style={{ ...card, background: 'var(--surface-alt, #F2F6FC)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4B5563)', lineHeight: 1.5 }}>
          Define how this external system's data maps into Nexusora Books. Map its field names, its
          accounts, and its transaction types once — then every record it posts to the mapped import
          endpoint is translated automatically into a voucher.
        </p>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Source key *</label>
            <input style={input} value={m.source} onChange={(e) => setM({ source: e.target.value })} placeholder="a unique key, e.g. pos_system" />
          </div>
          <div>
            <label style={label}>Name</label>
            <input style={input} value={m.label} onChange={(e) => setM({ label: e.target.value })} placeholder="e.g. Point of Sale" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={m.autopost} onChange={(e) => setM({ autopost: e.target.checked })} /> Auto-post on import
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={m.active} onChange={(e) => setM({ active: e.target.checked })} /> Active
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>Fixed type:</span>
            <select style={{ ...input, width: 'auto' }} value={m.fixedVoucherType} onChange={(e) => setM({ fixedVoucherType: e.target.value })}>
              <option value="">— use type map —</option>
              {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>Default branch:</span>
            <select style={{ ...input, width: 'auto' }} value={m.fixedBranch || ''} onChange={(e) => setM({ fixedBranch: e.target.value })}>
              <option value="">— use branch map —</option>
              {branches.map((b) => <option key={b._id} value={b.code}>{b.code} — {b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', marginTop: 0 }}>1. Field Mapping</h3>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0 }}>For each field below, enter the matching field name from the external system. Leave blank if not sent.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {FIELDS.map(([key, lbl, req]) => (
            <div key={key}>
              <label style={label}>{lbl}{req ? ' *' : ''}</label>
              <input style={input} value={m.fieldMap[key] || ''} onChange={(e) => setField(key, e.target.value)} placeholder="source field name" />
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>2. Account Mapping</h3>
          <button style={ghostBtn} onClick={addAcct}><FiPlus size={14} /> Add</button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0 }}>Match each external account identifier to a Books account.</p>
        {m.accountMap.length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF' }}>No account mappings yet.</p>}
        {m.accountMap.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <input style={input} value={r.externalAccount} onChange={(e) => setAcct(i, 'externalAccount', e.target.value)} placeholder="external account id" />
            <select style={input} value={r.booksCode} onChange={(e) => setAcct(i, 'booksCode', e.target.value)}>
              <option value="">Books account…</option>
              {accounts.map((a) => <option key={a._id} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
            <input style={input} value={r.label || ''} onChange={(e) => setAcct(i, 'label', e.target.value)} placeholder="note (optional)" />
            <button style={{ ...ghostBtn, padding: 8, color: '#DC2626', justifyContent: 'center' }} onClick={() => delAcct(i)}><FiTrash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>3. Type Mapping</h3>
          <button style={ghostBtn} onClick={addType}><FiPlus size={14} /> Add</button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0 }}>Match the external system's transaction type values to Books voucher types. Skip if using a fixed type above.</p>

        {/* Per-person ledger settings. "Party side" turns a type into a person
            ledger posting: the person is debited (they owe us, e.g. an advance)
            or credited (we owe/settle them, e.g. gold received). It only applies
            when the record also carries a Person ID — so a type left on "— none —",
            or any record with no Person ID, posts as an ordinary two-account voucher. */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', margin: '4px 0 14px', paddingBottom: 12, borderBottom: '1px solid #EEF2F6' }}>
          <label style={{ fontSize: 12, color: '#6B7280' }}>Person ledger control a/c
            <input style={{ ...input, width: 140, display: 'block', marginTop: 4 }} value={m.partyControlCode || ''} onChange={(e) => setM({ partyControlCode: e.target.value })} placeholder="1100" />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>Ledger code prefix
            <input style={{ ...input, width: 120, display: 'block', marginTop: 4 }} value={m.partyCodePrefix || ''} onChange={(e) => setM({ partyCodePrefix: e.target.value })} placeholder="SL-" />
          </label>
          <span style={{ fontSize: 11, color: '#9CA3AF', flex: 1, minWidth: 180 }}>Person ledgers are created as <code>{(m.partyCodePrefix || 'SL-')}&lt;id&gt;</code> under control {m.partyControlCode || '1100'}.</span>
        </div>

        {/* Group-driven classification (preferred). When the Debit/Credit ledger
            group fields are mapped above, any leg whose group is in "Party groups"
            becomes that person's ledger automatically — no Party side needed. */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', margin: '0 0 14px', paddingBottom: 12, borderBottom: '1px solid #EEF2F6' }}>
          <label style={{ fontSize: 12, color: '#6B7280' }}>Party groups
            <input style={{ ...input, width: 110, display: 'block', marginTop: 4 }} value={m.partyGroups || ''} onChange={(e) => setM({ partyGroups: e.target.value })} placeholder="4,7" />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>Payable groups
            <input style={{ ...input, width: 100, display: 'block', marginTop: 4 }} value={m.partyPayableGroups || ''} onChange={(e) => setM({ partyPayableGroups: e.target.value })} placeholder="7" />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>Payable control a/c
            <input style={{ ...input, width: 130, display: 'block', marginTop: 4 }} value={m.partyPayableControlCode || ''} onChange={(e) => setM({ partyPayableControlCode: e.target.value })} placeholder="2000" />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>Only accept company id
            <input style={{ ...input, width: 130, display: 'block', marginTop: 4 }} value={m.sourceCompanyId || ''} onChange={(e) => setM({ sourceCompanyId: e.target.value })} placeholder="e.g. 328 (blank = any)" />
          </label>
          <span style={{ fontSize: 11, color: '#9CA3AF', flex: 1, minWidth: 180 }}>Receivable groups → control {m.partyControlCode || '1100'}; payable groups → {m.partyPayableControlCode || '2000'}. Records from other companies are rejected when a company id is set.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>External type</span>
          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>Books voucher type</span>
          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>Party side (person ledger)</span>
          <span />
        </div>
        {m.typeMap.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <input style={input} value={r.externalType} onChange={(e) => setType(i, 'externalType', e.target.value)} placeholder="external type value" />
            <select style={input} value={r.voucherType} onChange={(e) => setType(i, 'voucherType', e.target.value)}>
              {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={input} value={r.partySide || ''} onChange={(e) => setType(i, 'partySide', e.target.value || null)}>
              <option value="">— none —</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            <button style={{ ...ghostBtn, padding: 8, color: '#DC2626', justifyContent: 'center' }} onClick={() => delType(i)}><FiTrash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>4. Branch Mapping</h3>
          <button style={ghostBtn} onClick={addBranch}><FiPlus size={14} /> Add</button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0 }}>Match each external branch identifier to a Books branch. Skip if the system does not send a branch, or set a Default branch above.</p>
        {(m.branchMap || []).length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF' }}>No branch mappings yet.</p>}
        {(m.branchMap || []).map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <input style={input} value={r.externalBranch} onChange={(e) => setBranch(i, 'externalBranch', e.target.value)} placeholder="external branch id" />
            <select style={input} value={r.booksBranchCode} onChange={(e) => setBranch(i, 'booksBranchCode', e.target.value)}>
              <option value="">Books branch…</option>
              {branches.map((b) => <option key={b._id} value={b.code}>{b.code} — {b.name}</option>)}
            </select>
            <input style={input} value={r.label || ''} onChange={(e) => setBranch(i, 'label', e.target.value)} placeholder="note (optional)" />
            <button style={{ ...ghostBtn, padding: 8, color: '#DC2626', justifyContent: 'center' }} onClick={() => delBranch(i)}><FiTrash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={goldBtn}><FiSave size={15} /> {saving ? 'Saving…' : 'Save Integration'}</button>
        {m._id && <button onClick={remove} disabled={saving} style={{ ...ghostBtn, color: '#DC2626' }}><FiTrash2 size={14} /> Delete</button>}
      </div>
    </div>
  );
}