import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiShield, FiSearch, FiFilter } from 'react-icons/fi';
import { StaggerContainer, StaggerItem } from '../../components/common/Animate';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';
import ResponsiveTable from '../../components/common/ResponsiveTable';

const MODULE_OPTIONS = ['accounts', 'journals', 'invoices', 'bills', 'payments', 'payroll', 'settings', 'notes', 'todos', 'fixed_assets', 'reports'];
const ACTION_OPTIONS = ['create', 'update', 'delete', 'login', 'logout', 'approve', 'post', 'reverse', 'approve_payroll', 'approve_bill'];

const actionColors = {
  create: { bg: '#D1FAE5', text: '#065F46' },
  update: { bg: '#DBEAFE', text: '#1E40AF' },
  delete: { bg: '#FEE2E2', text: '#991B1B' },
  login: { bg: '#FEF3C7', text: '#92400E' },
  logout: { bg: '#F3F4F6', text: '#6B7280' },
  approve: { bg: '#D1FAE5', text: '#065F46' },
  post: { bg: '#DBEAFE', text: '#1E40AF' },
  reverse: { bg: '#FEE2E2', text: '#991B1B' },
  approve_payroll: { bg: '#D1FAE5', text: '#065F46' },
  approve_bill: { bg: '#D1FAE5', text: '#065F46' },
  read: { bg: '#F3F4F6', text: '#6B7280' },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ module: '', action: '', startDate: '', endDate: '' });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const { showToast, ToastComponent } = useToast();

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: 50, page });
      if (filters.module) params.append('module', filters.module);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const { data } = await api.get(`/audit?${params}`);
      if (data.success) {
        setLogs(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      showToast('Failed to fetch audit logs', 'error');
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/audit/stats');
      if (data.success) setStats(data.data);
    } catch {}
  };

  useEffect(() => { fetchLogs(); fetchStats(); }, []);
  useEffect(() => { fetchLogs(1); }, [filters]);

  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {ToastComponent}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1A3560', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiShield size={20} color="#C9A227" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Audit Log</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Complete trail of all system actions — who did what, when</p>
      </motion.div>

      {/* Clear Logs Button — admin only */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={async () => {
            const days = window.prompt('Delete audit logs older than how many days? (e.g. 30, 60, 90)');
            if (!days || isNaN(days)) return;
            const before = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
            if (!window.confirm(`Delete all audit logs older than ${days} days?`)) return;
            try {
              const { data } = await api.delete('/audit/clear', { data: { before } });
              if (data.success) { showToast(data.message); fetchLogs(1); fetchStats(); }
            } catch (err) { showToast('Failed to clear logs', 'error'); }
          }}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--danger)', color: 'var(--danger)',
            background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          🗑 Clear Old Logs
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Events', value: stats.totalLogs.toLocaleString(), color: '#1A3560' },
            { label: 'Last 7 Days', value: stats.recentLogs.toLocaleString(), color: '#2563EB' },
            { label: 'Top Module', value: stats.byModule[0]?._id || '—', color: '#16A34A' },
            { label: 'Top Action', value: stats.byAction[0]?._id || '—', color: '#D97706' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`, padding: '16px 20px' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{s.value}</p>
            </motion.div>
          ))}
        </div>
        
      )}

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
            <FiFilter size={14} /> Filters:
          </div>
          <select value={filters.module} onChange={(e) => setFilters((p) => ({ ...p, module: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff' }}>
            <option value="">All Modules</option>
            {MODULE_OPTIONS.map((m) => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{m.replace('_', ' ')}</option>)}
          </select>
          <select value={filters.action} onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff' }}>
            <option value="">All Actions</option>
            {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
          <input type="date" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }} />
          {(filters.module || filters.action || filters.startDate || filters.endDate) && (
            <button onClick={() => setFilters({ module: '', action: '', startDate: '', endDate: '' })}
              style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--danger)' }}>
              Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
            {pagination.total.toLocaleString()} events
          </span>
        </div>
      </div>

      {/* Log Table */}
<div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
  <ResponsiveTable minWidth={700}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Timestamp</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>User</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Action</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Module</th>
<th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Del</th>            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No audit events match your filters.</td></tr>
            ) : logs.map((log, i) => {
              const ac = actionColors[log.action] || actionColors.read;
              return (
                <tr key={log._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {log.user ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>{log.user.firstName} {log.user.lastName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{log.user.role?.replace('_', ' ')}</div>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>System</span>}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: ac.bg, color: ac.text, textTransform: 'capitalize',
                    }}>{log.action?.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                    {log.module?.replace('_', ' ')}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', maxWidth: 380 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description}</div>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Delete this audit entry?')) return;
                        try {
                          await api.delete(`/audit/${log._id}`);
                          fetchLogs(pagination.page);
                        } catch { showToast('Delete failed', 'error'); }
                      }}
                      style={{ padding: '3px 8px', color: 'var(--danger)', fontSize: 14, borderRadius: 4, border: '1px solid #FECACA', background: '#FEE2E2' }}
                      title="Delete this entry"
                    >🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
  </ResponsiveTable>
</div>
      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => fetchLogs(p)}
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
                background: p === pagination.page ? 'var(--deep-navy)' : '#fff',
                color: p === pagination.page ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}