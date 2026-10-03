// client/src/modules/ledgers/PartyLedgerListPage.jsx
//
// Subsidiary ledgers — one dynamic ledger per person, auto-provisioned from the
// integration and keyed by the external person ID. A ledger's balance is
// dynamic: a debit balance means the party owes us (Receivable); a credit
// balance means we owe the party (Payable). This page lists every party as
// "ID — Name" (names can duplicate; the ID is the key), split by that sign, and
// opens the running-balance statement on click.
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiChevronRight } from 'react-icons/fi';
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

function PartyTable({ title, accent, rows, onOpen }) {
  if (!rows.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: 0 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accent, marginRight: 8 }} />
          {title} <span style={{ color: C.mute, fontWeight: 500 }}>· {rows.length}</span>
        </h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              onClick={() => onOpen(p.id)}
              style={{ cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '12px 18px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.grey, background: '#F1F5F9', padding: '2px 7px', borderRadius: 5, marginRight: 10 }}>
                  {p.externalPartyId || p.code}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{p.name}</span>
              </td>
              <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>
                {money(p.balance)}
              </td>
              <td style={{ padding: '12px 10px 12px 0', width: 28, color: C.mute }}><FiChevronRight size={16} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PartyLedgerListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    api.get('/ledgers/parties')
      .then((res) => { if (alive && res.data?.success) setData(res.data.data); })
      .catch((e) => alive && setError(e.response?.data?.message || 'Could not load ledgers.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

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

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>Party Ledgers</h1>
        <p style={{ fontSize: 13, color: C.grey, margin: '4px 0 0' }}>
          Statement of account for each person. A ledger moves between receivable and payable as its balance changes.
        </p>
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
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by ID or name…"
              style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 9, border: `1px solid #D1D5DB`, fontSize: 14, background: '#fff' }}
            />
          </div>

          {receivables.length === 0 && payables.length === 0 && settled.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.mute, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
              {q ? 'No party matches your search.' : 'No party ledgers yet. They are created automatically as transactions arrive from the integration.'}
            </div>
          ) : (
            <>
              <PartyTable title="Receivables — they owe us" accent={C.teal} rows={receivables} onOpen={open} />
              <PartyTable title="Payables — we owe them" accent={C.red} rows={payables} onOpen={open} />
              <PartyTable title="Settled — zero balance" accent={C.mute} rows={settled} onOpen={open} />
            </>
          )}
        </>
      )}
    </div>
  );
}
