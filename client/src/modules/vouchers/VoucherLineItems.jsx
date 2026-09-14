// client/src/modules/vouchers/VoucherLineItems.jsx
// Reusable itemized line-items editor for sales/purchase-style vouchers.
// Columns: Description, Qty, Unit, Price/Unit, Amount. Computes subtotal,
// applies a discount, and reports the effective total up to the parent.
// The parent posts ONE total to the ledger; these items are supporting detail.
import { FiPlus, FiTrash2 } from 'react-icons/fi';

const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function VoucherLineItems({ items, discount, onItemsChange, onDiscountChange, isMobile }) {
  const rows = items && items.length ? items : [{ description: '', quantity: 1, unit: '', unitPrice: 0 }];

  const setRow = (i, key, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r);
    onItemsChange(next);
  };
  const addRow = () => onItemsChange([...rows, { description: '', quantity: 1, unit: '', unitPrice: 0 }]);
  const delRow = (i) => onItemsChange(rows.filter((_, idx) => idx !== i));

  const lineAmount = (r) => (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
  const subtotal = rows.reduce((s, r) => s + lineAmount(r), 0);
  const total = Math.round((subtotal - (Number(discount) || 0)) * 100) / 100;

  const cell = { padding: '6px', fontSize: 13 };
  const input = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #D1D5DB)', fontSize: 13, boxSizing: 'border-box' };
  const th = { padding: '8px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left', textTransform: 'uppercase' };

  // Mobile: stacked cards per line. Desktop: table.
  if (isMobile) {
    return (
      <div>
        {rows.map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--border, #E5E7EB)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <input style={{ ...input, marginBottom: 8 }} placeholder="Description" value={r.description || ''} onChange={(e) => setRow(i, 'description', e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input style={input} type="number" placeholder="Qty" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} />
              <input style={input} placeholder="Unit (Kg, pcs)" value={r.unit || ''} onChange={(e) => setRow(i, 'unit', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
              <input style={input} type="number" placeholder="Price/Unit" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} />
              <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{money(lineAmount(r))}</div>
            </div>
            <button onClick={() => delRow(i)} style={{ marginTop: 8, color: '#DC2626', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiTrash2 size={13} /> Remove</button>
          </div>
        ))}
        <button onClick={addRow} style={{ padding: '9px 14px', borderRadius: 8, border: '1px dashed var(--border, #C9A227)', background: 'transparent', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><FiPlus size={14} /> Add Item</button>
        <div style={{ borderTop: '2px solid var(--border, #E5E7EB)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0', alignItems: 'center' }}>
            <span>Discount</span>
            <input style={{ ...input, width: 120, textAlign: 'right' }} type="number" value={discount || 0} onChange={(e) => onDiscountChange(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, padding: '8px 0', color: 'var(--deep-navy, #012158)', borderTop: '1px solid #EEE' }}><span>Total</span><span>{money(total)}</span></div>
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
              <th style={{ ...th, width: '40%' }}>Description</th>
              <th style={{ ...th, width: 70 }}>Qty</th>
              <th style={{ ...th, width: 90 }}>Unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Price/Unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={{ ...th, width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <td style={cell}><input style={input} placeholder="Item description" value={r.description || ''} onChange={(e) => setRow(i, 'description', e.target.value)} /></td>
                <td style={cell}><input style={input} type="number" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} /></td>
                <td style={cell}><input style={input} placeholder="Kg" value={r.unit || ''} onChange={(e) => setRow(i, 'unit', e.target.value)} /></td>
                <td style={cell}><input style={{ ...input, textAlign: 'right' }} type="number" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} /></td>
                <td style={{ ...cell, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{money(lineAmount(r))}</td>
                <td style={cell}><button onClick={() => delRow(i)} title="Remove" style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><FiTrash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} style={{ marginTop: 10, padding: '9px 14px', borderRadius: 8, border: '1px dashed var(--border, #C9A227)', background: 'transparent', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiPlus size={14} /> Add Item</button>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <div style={{ width: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', alignItems: 'center' }}>
            <span>Discount</span>
            <input style={{ ...input, width: 130, textAlign: 'right' }} type="number" value={discount || 0} onChange={(e) => onDiscountChange(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, padding: '10px 0', color: 'var(--deep-navy, #012158)', borderTop: '2px solid var(--border, #E5E7EB)' }}><span>Total</span><span>{money(total)}</span></div>
        </div>
      </div>
    </div>
  );
}
