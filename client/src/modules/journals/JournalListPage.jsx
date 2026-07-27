// client/src/modules/journals/JournalListPage.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiPlus, FiEye, FiCornerDownLeft, FiSearch } from 'react-icons/fi';
import { exportJournals } from '../reports/dataExports';
import journalService from '../../services/journalService';
import EntryDetailsModal from '../../components/common/EntryDetailsModal';
import api from '../../services/api';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import { useTenant } from '../../context/TenantContext';

export default function JournalListPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [viewEntry, setViewEntry] = useState(null);
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const { companyName } = useTenant();

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterType) filters.journalType = filterType;
      const result = await journalService.getAll(filters);
      if (result.success) setEntries(result.data);
    } catch (error) {
      showToast('Failed to fetch entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, [filterStatus, filterType]);

  const openView = async (id) => {
    try {
      const { data } = await api.get('/journals/' + id);
      if (data.success) setViewEntry(data.data);
    } catch { showToast('Could not load entry', 'error'); }
  };

  const handlePost = async (id) => {
    if (!window.confirm('Post this journal entry? This will update account balances and cannot be undone (only reversed).')) return;
    try {
      const result = await journalService.post(id);
      if (result.success) {
        showToast(result.message);
        fetchEntries();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to post', 'error');
    }
  };

  const handleReverse = async (id) => {
    if (!window.confirm('Reverse this posted entry? A new reversing entry will be created.')) return;
    try {
      const result = await journalService.reverse(id);
      if (result.success) {
        showToast(result.message);
        fetchEntries();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to reverse', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft entry?')) return;
    try {
      const result = await journalService.delete(id);
      if (result.success) {
        showToast(result.message);
        fetchEntries();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  return (
    <div>
      {ToastComponent}
      <EntryDetailsModal
        open={!!viewEntry}
        onClose={() => setViewEntry(null)}
        title={viewEntry ? viewEntry.entryNumber : ''}
        subtitle={viewEntry ? (viewEntry.journalType || '').replace('_',' ') + ' · ' + new Date(viewEntry.date).toLocaleDateString('en-GB') : ''}
        record={viewEntry || {}}
        rows={viewEntry ? [
          ['Description', viewEntry.description || '—'],
          ['Total Debit', 'GHS ' + Number(viewEntry.totalDebit||0).toFixed(2)],
          ['Total Credit', 'GHS ' + Number(viewEntry.totalCredit||0).toFixed(2)],
          ['Status', viewEntry.status],
          ['Lines', String((viewEntry.lines||[]).length) + ' account line(s)'],
        ] : []}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Journal Entries</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{entries.length} entries</p>
        </div>
          <button onClick={() => navigate('/journals/new')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', background: 'var(--nexusora-gold)',
          color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)',
          fontSize: 14, fontWeight: 600,
        }}>
          <FiPlus size={16} /> New Entry
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff' }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
          <option value="reversed">Reversed</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff' }}>
          <option value="">All types</option>
          <option value="general">General</option>
          <option value="sales">Sales</option>
          <option value="purchases">Purchases</option>
          <option value="cash_receipts">Cash Receipts</option>
          <option value="cash_payments">Cash Payments</option>
        </select>
        <button onClick={() => exportJournals(entries, companyName)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--nexusora-gold, #C9A227)', background: '#fff', color: '#B8860B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FiDownload size={15} /> Export Excel
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Entry #</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Debit</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Credit</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No journal entries yet.</td></tr>
            ) : entries.map((entry, i) => {
              const sc = getStatusColor(entry.status);
              return (
                <tr key={entry._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 600, fontFamily: 'monospace' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span title={entry.status === 'posted' ? 'Posted' : entry.status === 'reversed' ? 'Reversed' : 'Draft'}
                        style={{ flexShrink: 0, fontSize: 12,
                          color: entry.status === 'posted' ? '#059669' : entry.status === 'reversed' ? '#DC2626' : '#D97706' }}>
                        {'●'}
                      </span>
                      <button onClick={() => openView(entry._id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--tech-blue)', fontWeight: 600, fontFamily: 'monospace', cursor: 'pointer', textDecoration: 'underline' }}>{entry.entryNumber}</button>
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>{formatDate(entry.date)}</td>
                  <td style={{ padding: '11px 16px', textTransform: 'capitalize' }}>{entry.journalType?.replace('_', ' ')}</td>
                  <td style={{ padding: '11px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description || '—'}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(entry.totalDebit)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(entry.totalCredit)}</td>

                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {entry.status === 'draft' && (
                        <>
                          <button onClick={() => handlePost(entry._id)} title="Post" style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: 11, fontWeight: 600, border: '1px solid var(--success)' }}>Post</button>
                          <button onClick={() => handleDelete(entry._id)} title="Delete" style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: 11 }}>Del</button>
                        </>
                      )}
                      {entry.status === 'posted' && (
                        <button onClick={() => handleReverse(entry._id)} title="Reverse" style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--warning)', fontSize: 11, fontWeight: 600, border: '1px solid var(--warning)' }}>
                          <FiCornerDownLeft size={12} /> Rev
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}