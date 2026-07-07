import { useState, useRef, useEffect } from 'react';
import { FiBell, FiCheck, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handle = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const items = [];

      // Check for draft journals
      try {
        const { data } = await api.get('/journals?status=draft&limit=5');
        if (data.success && data.data.length > 0) {
          items.push({
            id: 'draft-journals', type: 'warning',
            title: `${data.data.length} draft journal${data.data.length > 1 ? 's' : ''} pending`,
            message: 'Review and post your draft entries',
            path: '/journals', time: 'Action needed',
          });
        }
      } catch {}

      // Check for unpaid invoices
      try {
        const { data } = await api.get('/invoices?status=sent');
        if (data.success) {
          const overdue = data.data.filter((inv) => new Date(inv.dueDate) < new Date());
          if (overdue.length > 0) {
            items.push({
              id: 'overdue-invoices', type: 'danger',
              title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`,
              message: 'Follow up on overdue customer payments',
              path: '/invoicing/invoices', time: 'Urgent',
            });
          }
          if (data.data.length > 0) {
            items.push({
              id: 'unpaid-invoices', type: 'info',
              title: `${data.data.length} unpaid invoice${data.data.length > 1 ? 's' : ''}`,
              message: 'Outstanding receivables need attention',
              path: '/invoicing/invoices', time: 'Review',
            });
          }
        }
      } catch {}

      // Check for unpaid bills
      try {
        const { data } = await api.get('/bills?status=approved');
        if (data.success) {
          const overdue = data.data.filter((b) => new Date(b.dueDate) < new Date());
          if (overdue.length > 0) {
            items.push({
              id: 'overdue-bills', type: 'danger',
              title: `${overdue.length} overdue bill${overdue.length > 1 ? 's' : ''}`,
              message: 'Pay your vendors to avoid late penalties',
              path: '/bills/list', time: 'Urgent',
            });
          }
        }
      } catch {}

      // Check for pending tasks
      try {
        const { data } = await api.get('/todos?status=pending');
        if (data.success && data.data.length > 0) {
          const overdue = data.data.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
          if (overdue.length > 0) {
            items.push({
              id: 'overdue-tasks', type: 'warning',
              title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
              message: 'Complete your overdue to-do items',
              path: '/todos', time: 'Overdue',
            });
          }
        }
      } catch {}

      // Check announcements
      try {
        const { data } = await api.get('/notes?type=announcement');
        if (data.success && data.data.length > 0) {
          const recent = data.data.filter((n) => {
            const age = (Date.now() - new Date(n.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return age < 7;
          });
          if (recent.length > 0) {
            items.push({
              id: 'announcements', type: 'info',
              title: `${recent.length} recent announcement${recent.length > 1 ? 's' : ''}`,
              message: recent[0]?.title || 'New company announcements',
              path: '/notes', time: 'This week',
            });
          }
        }
      } catch {}

      setNotifications(items);
    } catch {} finally { setLoading(false); }
  };

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) fetchNotifications();
  };

  const handleClick = (notif) => {
    navigate(notif.path);
    setIsOpen(false);
  };

  const dismissNotif = (e, id) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const typeColors = {
    danger: { bg: '#FEE2E2', dot: '#DC2626', border: '#FECACA' },
    warning: { bg: '#FEF3C7', dot: '#D97706', border: '#FDE68A' },
    info: { bg: '#DBEAFE', dot: '#2563EB', border: '#BFDBFE' },
    success: { bg: '#D1FAE5', dot: '#16A34A', border: '#A7F3D0' },
  };

  const unreadCount = notifications.length;

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{
        position: 'relative', color: 'var(--text-secondary)', padding: 8,
        borderRadius: 'var(--radius-sm)',
      }} title="Notifications">
        <FiBell size={19} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--danger)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 380, background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          zIndex: 500, overflow: 'hidden',
          animation: 'dropIn 200ms ease',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unreadCount} items</span>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading ? (
              <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Checking...</p>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <FiCheck size={28} color="var(--success)" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>All caught up!</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No outstanding items need attention.</p>
              </div>
            ) : notifications.map((notif) => {
              const tc = typeColors[notif.type] || typeColors.info;
              return (
                <div key={notif.id} onClick={() => handleClick(notif)} style={{
                  padding: '12px 18px', borderBottom: '1px solid #F5F5F5',
                  cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
                  transition: 'background 100ms',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tc.dot, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{notif.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notif.message}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: tc.dot, fontWeight: 600 }}>{notif.time}</span>
                    <button onClick={(e) => dismissNotif(e, notif.id)} style={{ padding: 2, color: 'var(--text-muted)' }}><FiX size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          <style>{`@keyframes dropIn { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
      )}
    </div>
  );
}