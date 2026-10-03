// client/src/modules/ledgers/PartyLedgerListPage.jsx
//
// Subsidiary ledgers — one dynamic ledger per person, keyed by an ID. Ledgers
// are auto-provisioned from the integration, and can also be created by hand
// here (for clients not using any external app). A ledger's balance is dynamic:
// a debit balance means the party owes us (Receivable); a credit balance means
// we owe the party (Payable). Balances only move through posted vouchers /
// journals — they are never edited here.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiChevronRight, FiPlus, FiEdit2, FiSlash, FiCheckCircle, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

const C = {
  navy: '#1A3560', gold: '#C9A227', teal: '#0D9488', red: '#DC2626',
  green: '#16A34A', grey: '#6B7280', mute: '#9CA3AF', border: '#E2E8F0', surface: '#fff',
};
const money = (n) => formatCurrency(Math.abs(Number(n) || 0), 'GHS');

function SummaryCard({ label, value, accent, sub }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `4px solid ${accent}`, borderRadius: 10, padding: '14px 18px' }}>
      <p style={{ fontSize: 11, color: C.mute, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0, fontFamily: 'var(--font-heading)' }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: C.mute, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: C.grey, display: 'inline-flex', alignItems: 'center' };

function PartyTable({ title, accent, rows, onOpen, onRename, onToggle }) {
  if (!rows.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: 0 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accent, marginRight: 8 }} />
          {title} <span style={{ color: C.mute, fontWeight: 500 }}>· {rows.length}</span>
        </h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: p.isActive ? 1 : 0.55 }}>
              <td onClick={() => onOpen(p.id)} style={{ padding: '12px 18px', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.grey, background: '#F1F5F9', padding: '2px 7px', borderRadius: 5, marginRight: 10 }}>
                  {p.externalPartyId || p.code}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{p.name}</span>
                {!p.isActive && <span style={{ fontSize: 10, fontWeight: 700, color: C.mute, background: '#F1F5F9', padding: '2px 7px', borderRadius: 10, marginLeft: 8 }}>INACTIVE</span>}
              </td>
              <td onClick={() => onOpen(p.id)} style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: accent, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                {money(p.balance)}
              </td>
              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button title="Rename" style={iconBtn} onClick={(e) => { e.stopPropagation(); onRename(p); }}><FiEdit2 size={15} /></button>
                <button title={p.isActive ? 'Deactivate' : 'Reactivate'} style={{ ...iconBtn, color: p.isActive ? C.red : C.green }} onClick={(e) => { e.stopPropagation(); onToggle(p); }}>
                  {p.isActive ? <FiSlash size={15} /> : <FiCheckCircle size={15} />}
                </button>
                <button title="Open statement" style={iconBtn} onClick={() => onOpen(p.id)}><FiChevronRight size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Minimal modal.
function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>{title}</h3>
          <button style={iconBtn} onClick={onClose}><FiX size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' };
const label = { fontSize: 12, color: C.grey, fontWeight: 600, display: 'block', margin: '0 0 6px' };
const goldBtn = { background: C.gold, color: '#1A1A1A', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const ghostBtn = { background: '#fff', color: C.grey, border: '1px solid #D1D5DB', borderRadius: 9, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };

export default function PartyLedgerListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const [create, setCreate] = useState(null);   // { name, partyId } when open
  const [rename, setRename] = useState(null);    // { id, name } when open
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/ledgers/parties')
      .then((res) => { if (res.data?.success) setData(res.data.data); })
      .catch((e) => setError(e.response?.data?.message || 'Could not load ledgers.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const { receivables, payables, settled } = useMemo(() => {
    const parties = data?.parties || [];
    const needle = q.trim().toLowerCase();
    const match = (p) => !needle
      || (p.name || '').toLowerCase().includes(needle)
      || (p.externalPartyId || '').toLowerCase().includes(needle)
      || (p.code || '').toLowerCase().includes(needle);
    const f = parties.filter(match);
    return {
      receivables: f.filter((p) => p.balance > 0).sort((a, b) => b.balance - a.balance),
      payables: f.filter((p) => p.balance < 0).sort((a, b) => a.balance - b.balance),
      settled: f.filter((p) => p.balance === 0).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    };
  }, [data, q]);

  const open = (id) => navigate(`/ledgers/parties/${id}`);
  const s = data?.summary || {};

  const submitCreate = async () => {
    setFormErr('');
    if (!create.name.trim() || !create.partyId.trim()) { setFormErr('Name and ID are both required.'); return; }
    setBusy(true);
    try {
      const res = await api.post('/ledgers/parties', { name: create.name.trim(), partyId: create.partyId.trim() });
      if (res.data?.success) { setCreate(null); load(); }
      else setFormErr(res.data?.message || 'Could not create the ledger.');
    } catch (e) { setFormErr(e.response?.data?.message || 'Could not create the ledger.'); }
    finally { setBusy(false); }
  };

  const submitRename = async () => {
    setFormErr('');
    if (!rename.name.trim()) { setFormErr('Name is required.'); return; }
    setBusy(true);
    try {
      const res = await api.patch(`/ledgers/parties/${rename.id}`, { name: rename.name.trim() });
      if (res.data?.success) { setRename(null); load(); }
      else setFormErr(res.data?.message || 'Could not rename.');
    } catch (e) { setFormErr(e.response?.data?.message || 'Could not rename.'); }
    finally { setBusy(false); }
  };

  const toggleActive = async (p) => {
    try { await api.patch(`/ledgers/parties/${p.id}`, { isActive: !p.isActive }); load(); }
    catch { /* no-op; list reload would show truth */ }
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>Party Ledgers</h1>
          <p style={{ fontSize: 13, color: C.grey, margin: '4px 0 0' }}>
            Statement of account for each person. A ledger moves between receivable and payable as its balance changes.
          </p>
        </div>
        <button style={goldBtn} onClick={() => { setFormErr(''); setCreate({ name: '', partyId: '' }); }}>
          <FiPlus size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> New Party Ledger
        </button>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 40, color: C.grey }}>Loading ledgers…</div>
      ) : !data ? null : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
            <SummaryCard label="Total Receivable" value={money(s.receivableTotal)} accent={C.teal} sub="people who owe us" />
            <SummaryCard label="Total Payable" value={money(s.payableTotal)} accent={C.red} sub="people we owe" />
            <SummaryCard label="Net Position" value={money(s.net)} accent={s.net >= 0 ? C.green : C.red} sub={s.net >= 0 ? 'net receivable' : 'net payable'} />
            <SummaryCard label="Parties" value={String(s.count ?? 0)} accent={C.navy} sub="total ledgers" />
          </div>

          <div style={{ position: 'relative', marginBottom: 18, maxWidth: 420 }}>
            <FiSearch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.mute }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID or name…"
              style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 9, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          {receivables.length === 0 && payables.length === 0 && settled.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.mute, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
              {q ? 'No party matches your search.' : 'No party ledgers yet. Create one with “New Party Ledger”, or they appear automatically as transactions arrive from the integration.'}
            </div>
          ) : (
            <>
              <PartyTable title="Receivables — they owe us" accent={C.teal} rows={receivables} onOpen={open} onRename={(p) => { setFormErr(''); setRename({ id: p.id, name: p.name }); }} onToggle={toggleActive} />
              <PartyTable title="Payables — we owe them" accent={C.red} rows={payables} onOpen={open} onRename={(p) => { setFormErr(''); setRename({ id: p.id, name: p.name }); }} onToggle={toggleActive} />
              <PartyTable title="Settled — zero balance" accent={C.mute} rows={settled} onOpen={open} onRename={(p) => { setFormErr(''); setRename({ id: p.id, name: p.name }); }} onToggle={toggleActive} />
            </>
          )}
        </>
      )}

      {create && (
        <Modal title="New Party Ledger" onClose={() => setCreate(null)}>
          <label style={label}>Name</label>
          <input autoFocus style={inputStyle} value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} placeholder="e.g. Kofi Mensah" />
          <label style={{ ...label, marginTop: 14 }}>Unique ID (ledger key)</label>
          <input style={inputStyle} value={create.partyId} onChange={(e) => setCreate({ ...create, partyId: e.target.value })} placeholder="e.g. K-007 or a phone number" />
          <p style={{ fontSize: 11.5, color: C.mute, margin: '8px 0 0' }}>Any unique identifier you use for this person. Balances build up only from posted vouchers/journals.</p>
          {formErr && <p style={{ color: C.red, fontSize: 13, margin: '12px 0 0' }}>{formErr}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button style={ghostBtn} onClick={() => setCreate(null)} disabled={busy}>Cancel</button>
            <button style={goldBtn} onClick={submitCreate} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </Modal>
      )}

      {rename && (
        <Modal title="Rename Ledger" onClose={() => setRename(null)}>
          <label style={label}>Name</label>
          <input autoFocus style={inputStyle} value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} />
          <p style={{ fontSize: 11.5, color: C.mute, margin: '8px 0 0' }}>The ID and balance don’t change — only the display name.</p>
          {formErr && <p style={{ color: C.red, fontSize: 13, margin: '12px 0 0' }}>{formErr}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button style={ghostBtn} onClick={() => setRename(null)} disabled={busy}>Cancel</button>
            <button style={goldBtn} onClick={submitRename} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
