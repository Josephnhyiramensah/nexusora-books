import { FiX, FiUser, FiClock } from 'react-icons/fi';

// Shared "who did what, when" details modal. Works for journals, invoices, and
// bills — pass the record and a small config describing its fields. Keeps the
// list tables clean; the full attribution lives here, one click away.
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

const nameOf = (u) => (u ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.email || '—' : '—');
const roleLabel = (u) => (u && u.role ? ' · ' + String(u.role).replace('_', ' ') : '');

export default function EntryDetailsModal({ open, onClose, title, subtitle, rows = [], record }) {
  if (!open) return null;
  const created = record?.createdBy;
  const posted = record?.postedBy;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 'var(--radius-md)', width: 560, maxWidth: '96vw', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--deep-navy)' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><FiX size={20} /></button>
        </div>

        <div style={{ padding: '18px 24px' }}>
          {rows.map(([label, value], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: i < rows.length - 1 ? '1px solid #F5F5F5' : 'none', fontSize: 13.5 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px', background: 'var(--bg-app)', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Record History</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: posted ? 10 : 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FiUser size={15} color="#2563EB" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Created by {nameOf(created)}<span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{roleLabel(created)}</span></p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><FiClock size={11} /> {fmtDateTime(record?.createdAt)}</p>
            </div>
          </div>
          {posted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FiUser size={15} color="#16A34A" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Posted by {nameOf(posted)}<span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{roleLabel(posted)}</span></p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><FiClock size={11} /> {fmtDateTime(record?.postedAt)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
