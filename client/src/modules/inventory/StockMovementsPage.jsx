import { useState, useEffect } from 'react';
import { FiFilter } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';
import ResponsiveTable from '../../components/common/ResponsiveTable';

// The stock audit trail — every movement, newest first, scoped to the branch
// selected in the top bar (or all branches when none is selected).
const th = { padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' };
const thR = { ...th, textAlign: 'right' };

const TYPE_LABEL = {
  receipt: 'Receipt', sale: 'Sale', issue: 'Issue', adjustment: 'Adjustment',
  transfer_out: 'Transfer out', transfer_in: 'Transfer in', opening_balance: 'Opening',
};
const TYPE_COLOR = {
  receipt: { bg: '#D1FAE5', fg: '#065F46' },
  opening_balance: { bg: '#E0E7FF', fg: '#3730A3' },
  transfer_in: { bg: '#D1FAE5', fg: '#065F46' },
  sale: { bg: '#FEE2E2', fg: '#991B1B' },
  issue: { bg: '#FEE2E2', fg: '#991B1B' },
  transfer_out: { bg: '#FEE2E2', fg: '#991B1B' },
  adjustment: { bg: '#FEF3C7', fg: '#92400E' },
};

export default function StockMovementsPage() {
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterItem, setFilterItem] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const { showToast, ToastComponent } = useToast();

  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterItem) params.set('item', filterItem);
      if (filterType) params.set('type', filterType);
      params.set('page', page);
      const { data } = await api.get(`/inventory/movements?${params.toString()}`);
      if (data.success) { setRows(data.data); setPages(data.pagination?.pages || 1); }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load movements', 'error');
      setRows([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/inventory').then(({ data }) => { if (data.success) setItems(data.data); }).catch(() => {});
  }, []);

  useEffect(() => { fetchRows(); /* eslint-disable-next-line */ }, [filterItem, filterType, page]);

  const selectStyle = { padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff', color: 'var(--text-primary)', cursor: 'pointer' };

  return (
    <div>
      {ToastComponent}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Stock Movements</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Every stock change — what moved, where, when, and at what cost. Follows the branch selected in the top bar.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiFilter size={15} color="var(--text-muted)" />
        <select value={filterItem} onChange={(e) => { setFilterItem(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All items</option>
          {items.map((i) => <option key={i._id} value={i._id}>{i.code} — {i.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <ResponsiveTable minWidth={880}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' }}>
          <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
            <th style={th}>Date</th>
            <th style={th}>Item</th>
            <th style={th}>Branch</th>
            <th style={th}>Type</th>
            <th style={thR}>Quantity</th>
            <th style={thR}>Unit Cost</th>
            <th style={th}>Reference</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr> :
            rows.length === 0 ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No stock movements yet.</td></tr> :
            rows.map((m, i) => {
              const c = TYPE_COLOR[m.type] || { bg: '#F3F4F6', fg: '#374151' };
              const positive = m.quantity > 0;
              return (
                <tr key={m._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>{m.date ? new Date(m.date).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.item?.code || '—'}</span>
                    <span style={{ color: 'var(--text-muted)' }}> {m.item?.name || ''}</span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>{m.branch?.name || '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>
                      {TYPE_LABEL[m.type] || m.type}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: positive ? '#065F46' : 'var(--danger)' }}>
                    {positive ? '+' : ''}{m.quantity}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(m.unitCost)}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--text-muted)' }}>{m.reference || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ResponsiveTable>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 18 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? 'var(--border)' : 'var(--text-secondary)' }}>Previous</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, cursor: page >= pages ? 'not-allowed' : 'pointer', color: page >= pages ? 'var(--border)' : 'var(--text-secondary)' }}>Next</button>
        </div>
      )}
    </div>
  );
}