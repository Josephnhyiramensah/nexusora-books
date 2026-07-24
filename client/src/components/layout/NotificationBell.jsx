import { useState, useRef, useEffect, useCallback } from 'react';
import { FiBell, FiCheck, FiX, FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * The bell is an INBOX, not an archive: it lists only UNREAD notifications.
 * Once read, an item leaves the bell and lives on in /announcements.
 *
 * Ages are computed against the server clock (serverNow), because a device with
 * a wrong timezone would otherwise report a fresh item as hours old.
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [real, setReal] = useState([]);
  const [derived, setDerived] = useState([]);
  const [unreadReal, setUnreadReal] = useState(0);
  const [skew, setSkew] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handle = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      if (data.success) setUnreadReal(data.data.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 60000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  const fetchReal = async () => {
    try {
      const { data } = await api.get('/notifications?limit=50');
      if (data.success) {
        setReal(data.data.filter((n) => !n.read));
        setUnreadReal(data.unread || 0);
        if (data.serverNow) setSkew(Date.now() - data.serverNow);
      }
    } catch { setReal([]); }
  };

  const fetchDerived = async () => {
    const items = [];
    try {
      const { data } = await api.get('/journals?status=draft&limit=5');
      if (data.success && data.data.length > 0) items.push({ id: 'draft-journals', type: 'warning', title: `${data.data.length} draft journal${data.data.length > 1 ? 's' : ''} pending`, message: 'Review and post your draft entries', path: '/journals', time: 'Action needed' });
    } catch {}
    try {
      const { data } = await api.get('/invoices?status=sent');
      if (data.success) {
        const overdue = data.data.filter((inv) => new Date(inv.dueDate) < new Date());
        if (overdue.length > 0) items.push({ id: 'overdue-invoices', type: 'danger', title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`, message: 'Follow up on overdue customer payments', path: '/invoicing/invoices', time: 'Urgent' });
        if (data.data.length > 0) items.push({ id: 'unpaid-invoices', type: 'info', title: `${data.data.length} unpaid invoice${data.data.length > 1 ? 's' : ''}`, message: 'Outstanding receivables need attention', path: '/invoicing/invoices', time: 'Review' });
      }
    } catch {}
    try {
      const { data } = await api.get('/bills?status=approved');
      if (data.success) {
        const overdue = data.data.filter((b) => new Date(b.dueDate) < new Date());
        if (overdue.length > 0) items.push({ id: 'overdue-bills', type: 'danger', title: `${overdue.length} overdue bill${overdue.length > 1 ? 's' : ''}`, message: 'Pay your vendors to avoid late penalties', path: '/bills/list', time: 'Urgent' });
      }
    } catch {}
    try {
      const { data } = await api.get('/todos?status=pending');
      if (data.success && data.data.length > 0) {
        const overdue = data.data.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
        if (overdue.length > 0) items.push({ id: 'overdue-tasks', type: 'warning', title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, message: 'Complete your overdue to-do items', path: '/todos', time: 'Overdue' });
      }
    } catch {}
    setDerived(items);
  };

  const handleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setLoading(true);
      await Promise.all([fetchReal(), fetchDerived()]);
      setLoading(false);
    }
  };

  // Open the full announcement. Marking read happens on the target page, which
  // also removes it from this list on the next open.
  const openReal = (n) => {
    setIsOpen(false);
    navigate(n.link || `/announcements?id=${n._id}`);
  };

  const markAllRead = async (e) => {
    e.stopPropagation();
    setReal([]);
    setUnreadReal(0);
    try { await api.post('/notifications/read-all'); } catch {}
  };

  const handleDerivedClick = (n) => { navigate(n.path); setIsOpen(false); };
  const dismissDerived = (e, id) => { e.stopPropagation(); setDerived((prev) => prev.filter((n) => n.id !== id)); };

  const typeColors = { danger: { dot: '#DC2626' }, warning: { dot: '#D97706' }, info: { dot: '#2563EB' }, success: { dot: '#16A34A' } };

  const ago = (d) => {
    const ms = (Date.now() - skew) - new Date(d).getTime();
    if (ms < 60000) return 'Just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days < 7 ? days + 'd ago' : new Date(d).toLocaleDateString('en-GB');
  };

  const badge = unreadReal + derived.length;
  const total = real.length + derived.length;

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{ position: 'relative', color: 'var(--text-secondary)', padding: 8, borderRadius: 'var(--radius-sm)' }} title="Notifications">
        <FiBell size={19} />
        {badge > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{badge > 9 ? '9+' : badge}</span>
        )}
      </button>

      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 380, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 500, overflow: 'hidden', animation: 'dropIn 200ms ease' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</h3>
            {real.length > 0
              ? <button onClick={markAllRead} style={{ fontSize: 11, color: '#2563EB', fontWeight: 600 }}>Mark all read</button>
              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} items</span>}
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {loading ? (
              <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Checking...</p>
            ) : total === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <FiCheck size={28} color="var(--success)" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>All caught up!</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No outstanding items need attention.</p>
              </div>
            ) : (
              <>
                {real.map((n) => {
                  const tc = typeColors[n.type] || typeColors.info;
                  return (
                    <div key={n._id} onClick={() => openReal(n)} style={{ padding: '12px 18px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', background: '#F8FAFF' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: tc.dot, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</p>
                        <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                          {n.source === 'platform' ? 'Nexusora Technologies' : n.createdByLabel} - {ago(n.createdAt)}
                        </p>
                      </div>
                      <FiArrowRight size={13} color="#9CA3AF" style={{ marginTop: 6, flexShrink: 0 }} />
                    </div>
                  );
                })}

                {real.length > 0 && derived.length > 0 && (
                  <div style={{ padding: '6px 18px', background: '#FAFAFA', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 0.4 }}>NEEDS ATTENTION</div>
                )}

                {derived.map((n) => {
                  const tc = typeColors[n.type] || typeColors.info;
                  return (
                    <div key={n.id} onClick={() => handleDerivedClick(n)} style={{ padding: '12px 18px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: tc.dot, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.message}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: tc.dot, fontWeight: 600 }}>{n.time}</span>
                        <button onClick={(e) => dismissDerived(e, n.id)} style={{ padding: 2, color: 'var(--text-muted)' }}><FiX size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div onClick={() => { setIsOpen(false); navigate('/announcements'); }} style={{ padding: '11px 18px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#2563EB', cursor: 'pointer', background: '#FCFCFD' }}>
            View all announcements
          </div>

          <style>{`@keyframes dropIn { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
      )}
    </div>
  );
}
