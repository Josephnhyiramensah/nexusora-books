import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiBell, FiCheck } from 'react-icons/fi';
import api from '../../services/api';

export default function AnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [skew, setSkew] = useState(0);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const focusId = params.get('id');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=100');
      if (data.success) {
        setItems(data.data);
        if (data.serverNow) setSkew(Date.now() - data.serverNow);
      }
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    const target = items.find((i) => i._id === focusId);
    if (!target) return;
    if (!target.read) {
      api.post(`/notifications/${focusId}/read`).catch(() => {});
      setItems((prev) => prev.map((i) => (i._id === focusId ? { ...i, read: true } : i)));
    }
    const el = document.getElementById('ann-' + focusId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, loading, items.length]);

  const markAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    try { await api.post('/notifications/read-all'); } catch {}
  };

  // Ages are measured against the SERVER clock. A device with a wrong clock or
  // timezone would otherwise show a fresh announcement as hours old.
  const when = (d) => {
    const ms = (Date.now() - skew) - new Date(d).getTime();
    if (ms < 60000) return 'Just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const typeColor = { info: '#2563EB', success: '#16A34A', warning: '#D97706', danger: '#DC2626' };
  const unread = items.filter((i) => !i.read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Announcements</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{unread > 0 ? unread + ' unread' : 'All caught up'}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>Mark all read</button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
      ) : items.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '60px 20px', textAlign: 'center' }}>
          <FiBell size={34} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>No announcements yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Messages from your administrator and from Nexusora will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((n) => {
            const c = typeColor[n.type] || typeColor.info;
            const focused = n._id === focusId;
            return (
              <div key={n._id} id={'ann-' + n._id} style={{
                background: '#fff',
                border: focused ? '2px solid var(--nexusora-gold)' : '1px solid var(--border)',
                borderLeft: '4px solid ' + c,
                borderRadius: 'var(--radius-md)', padding: '18px 22px',
                boxShadow: focused ? '0 4px 16px rgba(201,162,39,0.18)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{n.title}</h3>
                  {!n.read && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#fff', background: c, padding: '3px 9px', borderRadius: 20, letterSpacing: 0.4 }}>NEW</span>}
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10, whiteSpace: 'pre-wrap' }}>{n.message}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600, color: n.source === 'platform' ? 'var(--deep-navy)' : 'inherit' }}>
                    {n.source === 'platform' ? 'Nexusora Technologies' : n.createdByLabel}
                  </span>
                  <span>-</span>
                  <span>{when(n.createdAt)}</span>
                  {n.read && <><span>-</span><FiCheck size={12} /><span>Read</span></>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
