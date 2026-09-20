// client/src/modules/vouchers/JournalVoucherLines.jsx
// Professional Journal Voucher entry: a multi-line table where each line hits
// one account with EITHER a debit OR a credit. Shows live Total Debit / Total
// Credit / Difference and enforces balance. No party, no payment mode — a pure
// accounting adjustment (depreciation, accruals, corrections, etc.).
import { FiPlus, FiTrash2 } from 'react-icons/fi';

const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Small inline searchable account picker (kept simple: native select is fine for
// journal lines; the parent passes the accounts list).
function AccountPick({ accounts, value, onChange }) {
  const input = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #D1D5DB)', fontSize: 13, boxSizing: 'border-box' };
  return (
    <select style={input} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select account…</option>
      {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
    </select>
  );
}

export default function JournalVoucherLines({ lines, accounts, onLinesChange, isMobile }) {
  const rows = lines && lines.length ? lines : [
    { account: '', description: '', debit: '', credit: '' },
    { account: '', description: '', debit: '', credit: '' },
  ];

  const setRow = (i, key, val) => {
    let next = rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r);
    // A line is either a debit or a credit — clear the opposite when one is typed.
    if (key === 'debit' && val) next = next.map((r, idx) => idx === i ? { ...r, credit: '' } : r);
    if (key === 'credit' && val) next = next.map((r, idx) => idx === i ? { ...r, debit: '' } : r);
    onLinesChange(next);
  };
  const addRow = () => onLinesChange([...rows, { account: '', description: '', debit: '', credit: '' }]);
  const delRow = (i) => onLinesChange(rows.filter((_, idx) => idx !== i));

  const totalDebit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = diff === 0 && totalDebit > 0;

  const cell = { padding: '6px', fontSize: 13, verticalAlign: 'top' };
  const input = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #D1D5DB)', fontSize: 13, boxSizing: 'border-box' };
  const th = { padding: '9px 8px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left', textTransform: 'uppercase' };

  // Mobile: card per line.
  if (isMobile) {
    return (
      <div>
        {rows.map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--border, #E5E7EB)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ marginBottom: 8 }}><AccountPick accounts={accounts} value={r.account} onChange={(v) => setRow(i, 'account', v)} /></div>
            <input style={{ ...input, marginBottom: 8 }} placeholder="Description (optional)" value={r.description || ''} onChange={(e) => setRow(i, 'description', e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input style={input} type="number" placeholder="Debit" value={r.debit} onChange={(e) => setRow(i, 'debit', e.target.value)} />
              <input style={input} type="number" placeholder="Credit" value={r.credit} onChange={(e) => setRow(i, 'credit', e.target.value)} />
            </div>
            <button onClick={() => delRow(i)} style={{ marginTop: 8, color: '#DC2626', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiTrash2 size={13} /> Remove line</button>
          </div>
        ))}
        <button onClick={addRow} style={{ padding: '9px 14px', borderRadius: 8, border: '1px dashed var(--border, #C9A227)', background: 'transparent', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><FiPlus size={14} /> Add Line</button>
        <div style={{ borderTop: '2px solid var(--border, #E5E7EB)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}><span>Total Debit</span><strong>{money(totalDebit)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}><span>Total Credit</span><strong>{money(totalCredit)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', fontWeight: 700, color: balanced ? '#065F46' : '#DC2626' }}>
            <span>{balanced ? '✓ Balanced' : 'Difference'}</span><span>{balanced ? money(totalDebit) : money(Math.abs(diff))}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ border: '1px solid var(--border, #E5E7EB)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--deep-navy, #012158)' }}>
              <th style={{ ...th, width: '32%' }}>Account</th>
              <th style={th}>Description</th>
              <th style={{ ...th, textAlign: 'right', width: 120 }}>Debit</th>
              <th style={{ ...th, textAlign: 'right', width: 120 }}>Credit</th>
              <th style={{ ...th, width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <td style={cell}><AccountPick accounts={accounts} value={r.account} onChange={(v) => setRow(i, 'account', v)} /></td>
                <td style={cell}><input style={input} placeholder="Line note (optional)" value={r.description || ''} onChange={(e) => setRow(i, 'description', e.target.value)} /></td>
                <td style={cell}><input style={{ ...input, textAlign: 'right' }} type="number" placeholder="0.00" value={r.debit} onChange={(e) => setRow(i, 'debit', e.target.value)} /></td>
                <td style={cell}><input style={{ ...input, textAlign: 'right' }} type="number" placeholder="0.00" value={r.credit} onChange={(e) => setRow(i, 'credit', e.target.value)} /></td>
                <td style={cell}><button onClick={() => delRow(i)} title="Remove" style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><FiTrash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F9FAFB', borderTop: '2px solid var(--border, #E5E7EB)' }}>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={2}>TOTAL</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{money(totalDebit)}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{money(totalCredit)}</td>
              <td style={cell}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <button onClick={addRow} style={{ padding: '9px 14px', borderRadius: 8, border: '1px dashed var(--border, #C9A227)', background: 'transparent', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiPlus size={14} /> Add Line</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: balanced ? '#065F46' : '#DC2626' }}>
          {balanced ? '✓ Balanced' : (totalDebit === 0 && totalCredit === 0 ? 'Enter debits and credits' : 'Difference: ' + money(Math.abs(diff)))}
        </span>
      </div>
    </div>
  );
}
