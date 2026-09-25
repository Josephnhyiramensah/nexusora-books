import { useState, useEffect } from 'react';
import api from '../../services/api';


//
// Picking an item also fills the line's description and price if they're empty,
// which is what the accountant expects and saves retyping.
export default function ItemSelect({ value, onChange, style }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Lazy import so this component has no hard dependency at module load.
       
        const { data } = await api.get('/inventory');
        if (!cancelled && data.success) setItems((data.data || []).filter((i) => i.isActive !== false));
      } catch { /* inventory unavailable — the picker just stays empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const base = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', fontSize: 12.5, outline: 'none',
    background: '#fff', color: value ? 'var(--text-primary)' : 'var(--text-muted)',
  };

  return (
    <select
      value={value || ''}
      onChange={(e) => {
        const id = e.target.value;
        const item = items.find((i) => String(i._id) === String(id)) || null;
        onChange(id || null, item);
      }}
      style={{ ...base, ...style }}
      title={value ? 'Stock will move when this document is posted' : 'Optional — link this line to an inventory item'}
    >
      <option value="">— none —</option>
      {items.map((i) => (
        <option key={i._id} value={i._id}>{i.code} — {i.name}</option>
      ))}
    </select>
  );
}