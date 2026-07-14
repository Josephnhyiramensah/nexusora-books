import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiServer, FiAlertCircle, FiCheckCircle, FiXCircle,
  FiRefreshCw, FiSearch, FiDollarSign, FiUser, FiEdit2,
} from 'react-icons/fi';
import nexusoraLogo from '../assets/nexusora-logo.png';
import api from '../services/api';
import { clearSettingsCache } from '../services/platformService';

const PLATFORM_TOKEN_KEY = 'platformToken';


const pHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem(PLATFORM_TOKEN_KEY) || ''}` });
const platformApi = {
  get:    (url)       => api.get(url,          { headers: pHeaders() }),
  post:   (url, body) => api.post(url, body,   { headers: pHeaders() }),
  put:    (url, body) => api.put(url, body,    { headers: pHeaders() }),
  delete: (url)       => api.delete(url,       { headers: pHeaders() }),
};


// ─── Company Info Settings Component ─────────────────────────────────────────
function CompanyInfoSettings() {
  const [form, setForm] = useState({
    company: { name: '', developer: '', email: '', supportEmail: '', phone: '', whatsapp: '', website: '', address: '', tagline: '' },
    subscription: { trialDays: 30, starterPrice: 300, professionalPrice: 990, enterprisePrice: 2400, currency: 'GHS' },
    branding: { platformName: 'Nexusora Books', primaryColor: '#1A3560', accentColor: '#C9A227' },
    smtp: { host: 'smtp.gmail.com', port: 587, user: '', fromName: 'Nexusora Books' },
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settingsTab, setSettingsTab] = useState('company');

  useEffect(() => {
    platformApi.get('/platform/settings/admin')
      .then(({ data }) => { if (data.success) setForm(data.data); })
      .catch((err) => console.warn('[PlatformSettings]', err.message))
      .finally(() => setLoadingSettings(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformApi.put('/platform/settings', form);
      clearSettingsCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  };

  const inp = { width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' };

  if (loadingSettings) return <p style={{ color: '#9CA3AF', padding: 20 }}>Loading settings...</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      {saved && <div style={{ padding: '12px 18px', background: '#D1FAE5', borderRadius: 10, color: '#065F46', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>✅ Saved. Changes are now live.</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
        {[{ key: 'company', label: '🏢 Contact Info' }, { key: 'subscription', label: '💰 Pricing' }, { key: 'branding', label: '🎨 Branding' }, { key: 'smtp', label: '📧 SMTP' }].map((t) => (
          <button key={t.key} onClick={() => setSettingsTab(t.key)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: settingsTab === t.key ? 600 : 400, color: settingsTab === t.key ? '#1A3560' : '#9CA3AF', borderBottom: settingsTab === t.key ? '2px solid #C9A227' : '2px solid transparent', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      {settingsTab === 'company' && (
        <div>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>These appear in the Enterprise modal, email footers, and support pages.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px,100%), 1fr))', gap: 16 }}>
            {[{ key: 'name', label: 'Company Name', ph: 'Nexusora Technology' }, { key: 'developer', label: 'Developer / CTO', ph: 'Prof. JNK Mensah' }, { key: 'email', label: 'Business Email', ph: 'nexusoratechnology@gmail.com' }, { key: 'supportEmail', label: 'Support Email', ph: 'support@nexusorabooks.com' }, { key: 'phone', label: 'Phone (display)', ph: '+233 548 211 310' }, { key: 'whatsapp', label: 'WhatsApp (digits)', ph: '233548211310' }, { key: 'website', label: 'Website', ph: 'nexusorabooks.com' }, { key: 'address', label: 'Address', ph: 'Kumasi, Ghana' }, { key: 'tagline', label: 'Tagline', ph: 'Where Knowledge Meets Technology' }].map((f) => (
              <div key={f.key}><label style={lbl}>{f.label}</label><input value={form.company?.[f.key] || ''} onChange={(e) => setForm((p) => ({ ...p, company: { ...p.company, [f.key]: e.target.value } }))} placeholder={f.ph} style={inp} onFocus={(e) => (e.target.style.borderColor = '#C9A227')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#F0F7FF', borderRadius: 8, fontSize: 12, color: '#2563EB' }}>💡 WhatsApp auto-link: wa.me/{form.company?.whatsapp}</div>
        </div>
      )}

      {settingsTab === 'subscription' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px,100%), 1fr))', gap: 16 }}>
          {[{ key: 'trialDays', label: 'Trial Days', type: 'number' }, { key: 'starterPrice', label: 'Starter (GHS/mo)', type: 'number' }, { key: 'professionalPrice', label: 'Professional (GHS/mo)', type: 'number' }, { key: 'enterprisePrice', label: 'Enterprise (GHS/mo)', type: 'number' }, { key: 'currency', label: 'Currency', type: 'text' }].map((f) => (
            <div key={f.key}><label style={lbl}>{f.label}</label><input type={f.type} value={form.subscription?.[f.key] ?? ''} onChange={(e) => setForm((p) => ({ ...p, subscription: { ...p.subscription, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value } }))} style={inp} onFocus={(e) => (e.target.style.borderColor = '#C9A227')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
          ))}
        </div>
      )}

      {settingsTab === 'branding' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))', gap: 16 }}>
          <div><label style={lbl}>Platform Name</label><input value={form.branding?.platformName || ''} onChange={(e) => setForm((p) => ({ ...p, branding: { ...p.branding, platformName: e.target.value } }))} style={inp} /></div>
          <div><label style={lbl}>Primary Color</label><div style={{ display: 'flex', gap: 8 }}><input type="color" value={form.branding?.primaryColor || '#1A3560'} onChange={(e) => setForm((p) => ({ ...p, branding: { ...p.branding, primaryColor: e.target.value } }))} style={{ width: 44, height: 40, borderRadius: 8, border: '1px solid #E2E8F0', padding: 2 }} /><input value={form.branding?.primaryColor || ''} onChange={(e) => setForm((p) => ({ ...p, branding: { ...p.branding, primaryColor: e.target.value } }))} style={{ ...inp, flex: 1 }} /></div></div>
          <div><label style={lbl}>Accent Color</label><div style={{ display: 'flex', gap: 8 }}><input type="color" value={form.branding?.accentColor || '#C9A227'} onChange={(e) => setForm((p) => ({ ...p, branding: { ...p.branding, accentColor: e.target.value } }))} style={{ width: 44, height: 40, borderRadius: 8, border: '1px solid #E2E8F0', padding: 2 }} /><input value={form.branding?.accentColor || ''} onChange={(e) => setForm((p) => ({ ...p, branding: { ...p.branding, accentColor: e.target.value } }))} style={{ ...inp, flex: 1 }} /></div></div>
        </div>
      )}

      {settingsTab === 'smtp' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%), 1fr))', gap: 16 }}>
            {[{ key: 'host', label: 'SMTP Host', ph: 'smtp.gmail.com', type: 'text' }, { key: 'port', label: 'Port', ph: '587', type: 'number' }, { key: 'user', label: 'Username', ph: 'nexusoratechnology@gmail.com', type: 'text' }, { key: 'fromName', label: 'From Name', ph: 'Nexusora Books', type: 'text' }].map((f) => (
              <div key={f.key}><label style={lbl}>{f.label}</label><input type={f.type} value={form.smtp?.[f.key] ?? ''} onChange={(e) => setForm((p) => ({ ...p, smtp: { ...p.smtp, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value } }))} placeholder={f.ph} style={inp} /></div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#FEF3C7', borderRadius: 10, fontSize: 13, color: '#92400E' }}>⚠️ SMTP password stays in <code>server/.env</code> as <code>SMTP_PASS</code>. Never store it in the database.</div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
          style={{ padding: '12px 32px', borderRadius: 10, background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #C9A227, #e0b930)', color: '#1A3560', fontSize: 14, fontWeight: 700, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '⏳ Saving...' : '💾 Save All Settings'}
        </motion.button>
      </div>
    </div>
  );
}

// ─── Tenant Detail Modal ──────────────────────────────────────────────────────
function TenantDetailModal({ tenant, onClose, onRefresh }) {
  const [note, setNote] = useState(tenant.supportNote || '');
  const [savingNote, setSavingNote] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [extending, setExtending] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [detailStats, setDetailStats] = useState(null);
  const [activeSection, setActiveSection] = useState('info');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    // Load users and stats
    Promise.all([
      platformApi.get(`/tenants/${tenant.subdomain}/users`).then(({ data }) => { if (data.success) setUsers(data.data); }).catch(() => {}),
      platformApi.get(`/tenants/${tenant.subdomain}/detail-stats`).then(({ data }) => { if (data.success) setDetailStats(data.data); }).catch(() => {}),
    ]).finally(() => setLoadingUsers(false));
  }, [tenant.subdomain]);

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await platformApi.put(`/tenants/${tenant.subdomain}/settings`, { supportNote: note });
      onRefresh();
    } catch {} finally { setSavingNote(false); }
  };

  const handleExtend = async () => {
    if (!window.confirm(`Extend ${tenant.subdomain} by ${extendDays} days?`)) return;
    setExtending(true);
    try {
      const current = tenant.subscription?.expiryDate ? new Date(tenant.subscription.expiryDate) : new Date();
      const newExpiry = new Date(Math.max(current.getTime(), Date.now()) + extendDays * 86400000);
      await platformApi.put(`/tenants/${tenant.subdomain}/settings`, { subscription: { ...tenant.subscription, expiryDate: newExpiry } });
      onRefresh();
      alert(`✅ Extended to ${newExpiry.toLocaleDateString('en-GB')}`);
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setExtending(false); }
  };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPassword) { setResetMsg('❌ Fill in both email and new password.'); return; }
    if (resetPassword.length < 8) { setResetMsg('❌ Password must be at least 8 characters.'); return; }
    setResetting(true); setResetMsg('');
    try {
      const { data } = await platformApi.post(`/tenants/${tenant.subdomain}/reset-password`, { email: resetEmail, newPassword: resetPassword });
      if (data.success) { setResetMsg('✅ Password reset successfully.'); setResetEmail(''); setResetPassword(''); }
      else setResetMsg(`❌ ${data.message}`);
    } catch (err) { setResetMsg(`❌ ${err.response?.data?.message || 'Failed.'}`); }
    finally { setResetting(false); }
  };

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A3560', marginBottom: 2 }}>{tenant.companyName}</h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>{tenant.subdomain}.nexusorabooks.com</p>
            </div>
            <button onClick={onClose} style={{ fontSize: 20, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>

          {/* Section tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              { key: 'info', label: '📋 Info' },
              { key: 'users', label: `👥 Users (${users.length})` },
              { key: 'billing', label: '💳 Billing' },
              { key: 'reset', label: '🔑 Password Reset' },
              { key: 'notes', label: '📝 Notes' },
            ].map((s) => (
              <button key={s.key} onClick={() => setActiveSection(s.key)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: activeSection === s.key ? 700 : 400, color: activeSection === s.key ? '#1A3560' : '#9CA3AF', borderBottom: activeSection === s.key ? '2px solid #C9A227' : '2px solid transparent', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* INFO */}
          {activeSection === 'info' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Owner', value: tenant.owner?.name },
                  { label: 'Email', value: tenant.owner?.email },
                  { label: 'Phone', value: tenant.owner?.phone || '—' },
                  { label: 'Plan', value: tenant.plan },
                  { label: 'Status', value: tenant.status },
                  { label: 'Registered', value: new Date(tenant.createdAt).toLocaleDateString('en-GB') },
                  { label: 'Expires', value: tenant.subscription?.expiryDate ? new Date(tenant.subscription.expiryDate).toLocaleDateString('en-GB') : '—' },
                  { label: 'Database', value: tenant.databaseName },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '10px 14px', background: '#F8FAFF', borderRadius: 8 }}>
                    <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3560', wordBreak: 'break-all' }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Usage Stats */}
              {detailStats && (
                <div style={{ background: '#F0F7FF', borderRadius: 10, padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#1A3560', marginBottom: 10 }}>📊 Usage Statistics</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Total Users', value: detailStats.totalUsers },
                      { label: 'Active Users', value: detailStats.activeUsers },
                      { label: 'Journal Entries', value: detailStats.journalCount },
                      { label: 'Invoices', value: detailStats.invoiceCount },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '10px 6px' }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: '#1A3560' }}>{s.value}</p>
                        <p style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {detailStats.lastLogin && (
                    <p style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>
                      Last login: <strong>{detailStats.lastLogin.user}</strong> on {detailStats.lastLogin.date ? new Date(detailStats.lastLogin.date).toLocaleDateString('en-GB') : '—'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* USERS */}
          {activeSection === 'users' && (
            <div>
              {loadingUsers ? <p style={{ color: '#9CA3AF' }}>Loading users...</p> :
               users.length === 0 ? <p style={{ color: '#9CA3AF' }}>No users found.</p> : (
                <div style={{ borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFF' }}>
                        {['Name', 'Email', 'Role', 'Status', 'Last Login'].map((h) => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u._id} style={{ borderTop: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.firstName} {u.lastName}</td>
                          <td style={{ padding: '10px 14px', color: '#6B7280' }}>{u.email}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: u.role === 'super_admin' ? '#DBEAFE' : '#F3F4F6', color: u.role === 'super_admin' ? '#1E40AF' : '#6B7280', textTransform: 'capitalize' }}>
                              {u.role?.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: u.isActive ? '#D1FAE5' : '#FEE2E2', color: u.isActive ? '#065F46' : '#991B1B' }}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: 12 }}>
                            {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-GB') : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* BILLING */}
          {activeSection === 'billing' && (
            <div>
              <div style={{ background: '#F0F7FF', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3560', marginBottom: 4 }}>Current Subscription</p>
                <p style={{ fontSize: 13, color: '#6B7280' }}>Plan: <strong style={{ textTransform: 'capitalize' }}>{tenant.plan}</strong></p>
                <p style={{ fontSize: 13, color: '#6B7280' }}>Expires: <strong>{tenant.subscription?.expiryDate ? new Date(tenant.subscription.expiryDate).toLocaleDateString('en-GB') : '—'}</strong></p>
                <p style={{ fontSize: 13, color: '#6B7280' }}>Status: <strong>{tenant.status}</strong></p>
              </div>

              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3560', marginBottom: 12 }}>📅 Extend Subscription Manually</p>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>Use this when a client pays by cash, bank transfer, or mobile money outside Paystack.</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <select value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))}
                  style={{ padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                  {[7, 14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
                <motion.button whileHover={{ scale: 1.02 }} onClick={handleExtend} disabled={extending}
                  style={{ padding: '9px 20px', borderRadius: 8, background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  {extending ? '⏳' : '➕ Extend'}
                </motion.button>
              </div>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>Extension adds to the current expiry date, not from today.</p>
            </div>
          )}

          {/* PASSWORD RESET */}
          {activeSection === 'reset' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Reset the password for any user in this tenant. The user's email must already exist in their system.</p>

              {resetMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16, background: resetMsg.startsWith('✅') ? '#D1FAE5' : '#FEE2E2', color: resetMsg.startsWith('✅') ? '#065F46' : '#DC2626' }}>
                  {resetMsg}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>USER EMAIL *</label>
                <select value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} style={{ ...inp }}>
                  <option value="">— Select a user —</option>
                  {users.map((u) => <option key={u._id} value={u.email}>{u.firstName} {u.lastName} ({u.email})</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>NEW PASSWORD * (min 8 characters)</label>
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Enter new password" style={inp} />
              </div>

              <motion.button whileHover={{ scale: 1.02 }} onClick={handleResetPassword} disabled={resetting}
                style={{ padding: '11px 24px', borderRadius: 8, background: resetting ? '#9CA3AF' : '#DC2626', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: resetting ? 'not-allowed' : 'pointer' }}>
                {resetting ? '⏳ Resetting...' : '🔑 Reset Password'}
              </motion.button>

              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>⚠️ Tell the user their new password immediately — they should change it on next login.</p>
            </div>
          )}

          {/* NOTES */}
          {activeSection === 'notes' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>Private notes — only visible to you in the developer console.</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6}
                placeholder="e.g. Called on 3 July — wants invoice PDF feature. Agreed to follow up next week. Paying by bank transfer monthly."
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <motion.button whileHover={{ scale: 1.02 }} onClick={handleSaveNote} disabled={savingNote}
                style={{ marginTop: 12, padding: '10px 22px', borderRadius: 8, background: '#C9A227', color: '#1A3560', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                {savingNote ? 'Saving...' : '💾 Save Note'}
              </motion.button>
            </div>
          )}

        </div>

        <div style={{ padding: '12px 24px', borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#9CA3AF', cursor: 'pointer' }}>Close</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MasterAdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [changingPlan, setChangingPlan] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [announcement, setAnnouncement] = useState({ title: '', message: '', type: 'info' });
  const [announceSending, setAnnounceSending] = useState(false);

  // Add Tenant Modal state
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [addTenantForm, setAddTenantForm] = useState({ companyName: '', subdomain: '', ownerName: '', ownerEmail: '', ownerPhone: '', plan: 'enterprise', adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '' });
  const [addTenantLoading, setAddTenantLoading] = useState(false);
  const [addTenantError, setAddTenantError] = useState('');

  const handleLogin = async () => {
   try {
      setPasswordError('');
      const { data } = await api.post('/platform-auth/login', { email, password });
      if (data.success) {
        localStorage.setItem(PLATFORM_TOKEN_KEY, data.data.accessToken);
        setAuthenticated(true);
        fetchAll();
      } else {
        setPasswordError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Invalid credentials');
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tenantsRes, statsRes] = await Promise.all([
       platformApi.get('/tenants'),
        platformApi.get('/tenants/admin/stats').catch(() => ({ data: { success: false } })),
      ]);
      if (tenantsRes.data.success) setTenants(tenantsRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
    } catch (err) { console.error('Fetch error:', err.message); }
    finally { setLoading(false); }
  };

  const handleSuspend = async (subdomain) => {
    if (!window.confirm(`Deactivate ${subdomain}?`)) return;
    setActionLoading(subdomain);
    try { await platformApi.post(`/tenants/${subdomain}/suspend`); fetchAll(); }
    catch {} finally { setActionLoading(''); }
  };

  const handleReactivate = async (subdomain) => {
    setActionLoading(subdomain);
    try { await platformApi.post(`/tenants/${subdomain}/reactivate`); fetchAll(); }
    catch {} finally { setActionLoading(''); }
  };

 const handlePlanChange = async (subdomain, newPlan) => {
    if (!window.confirm(`Change ${subdomain} to ${newPlan} plan?`)) return;
    setChangingPlan(subdomain);
    try {
      await platformApi.put(`/tenants/${subdomain}/plan`, { plan: newPlan })
;
      fetchAll();
    }
    catch (err) { alert(err.response?.data?.message || 'Failed to change plan'); }
    finally { setChangingPlan(''); }
  };

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const start = Date.now();
      const res = await api.get('/health');
      setHealthData({ status: res.data.success ? 'healthy' : 'degraded', ping: Date.now() - start, environment: res.data.environment, timestamp: res.data.timestamp });
    } catch { setHealthData({ status: 'down', ping: null }); }
    finally { setHealthLoading(false); }
  };

  const handleBroadcast = async () => {
    if (!announcement.title || !announcement.message) { alert('Fill in title and message'); return; }
    if (!window.confirm(`Send to ALL ${tenants.length} tenants?`)) return;
    setAnnounceSending(true);
    try {
      await Promise.all(tenants.map((t) => api.post('/notes', { title: announcement.title, content: announcement.message, type: 'announcement' }).catch(() => {})));
      setAnnouncement({ title: '', message: '', type: 'info' });
      alert(`✅ Sent to ${tenants.length} tenants`);
    } catch {} finally { setAnnounceSending(false); }
  };

  const planColor = { trial: '#6B7280', starter: '#2563EB', professional: '#C9A227', enterprise: '#1A3560', founding: '#16A34A' };
  const statusColor = { active: '#16A34A', trial: '#D97706', suspended: '#DC2626', expired: '#6B7280', founding: '#16A34A' };

  const filtered = tenants.filter((t) => {
    const q = search.toLowerCase();
    return (!search || t.subdomain.includes(q) || t.companyName?.toLowerCase().includes(q) || t.owner?.email?.toLowerCase().includes(q))
      && (!filterPlan || t.plan === filterPlan)
      && (!filterStatus || t.status === filterStatus);
  });

 const monthlyRevenue = tenants
  .filter((t) =>
    ['starter', 'professional', 'enterprise'].includes(t.plan) &&
    t.status === 'active' &&
    t.subscription?.lastPaymentRef // only count if they actually paid via Paystack
  )
  .reduce((sum, t) => sum + ({ starter: 300, professional: 990, enterprise: 2400 }[t.plan] || 0), 0);
  // ── Login Screen ─────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f2240, #1A3560)' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', width: 400, textAlign: 'center' }}>
          <img src={nexusoraLogo} alt="Nexusora" style={{ width: 60, height: 60, borderRadius: 14, marginBottom: 20 }} />
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#1A3560', marginBottom: 6 }}>Developer Console</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 28 }}>Nexusora Technologies · Restricted Access</p>
          {passwordError && <div style={{ padding: '10px 16px', background: '#FEE2E2', borderRadius: 10, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>{passwordError}</div>}
          <input
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="Platform admin email"
  style={{ width: '100%', padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', marginBottom: 12 }}
/>
          <input type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Master admin password"
            style={{ width: '100%', padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} />
          <motion.button onClick={handleLogin} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ width: '100%', padding: '13px', borderRadius: 10, background: '#1A3560', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            Access Console
          </motion.button>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 16 }}>Nexusora Technologies Internal Use Only</p>
        </motion.div>
      </div>
    );
  }

  // ── Authenticated Console ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      {/* Top Bar */}
      <div style={{ background: '#1A3560', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={nexusoraLogo} alt="Nexusora" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Nexusora Books</span>
            <span style={{ fontSize: 11, color: '#C9A227', marginLeft: 10, padding: '2px 8px', background: 'rgba(201,162,39,0.15)', borderRadius: 10 }}>Developer Console</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Prof. JNK Mensah · CTO</span>
          <motion.button onClick={fetchAll} whileHover={{ scale: 1.05 }} disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiRefreshCw size={13} /> Refresh
          </motion.button>
          <motion.button
            onClick={() => { setAuthenticated(false); setPassword(''); setTenants([]); }}
            whileHover={{ scale: 1.05 }}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.1)', color: '#fca5a5', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔒 Sign Out
          </motion.button>
        </div>
      </div>

      <div style={{ padding: 32 }}>
        {/* Main Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
          {[
            { key: 'overview', label: '📊 Overview' },
            { key: 'tenants', label: '🏢 Tenants' },
            { key: 'revenue', label: '💰 Revenue' },
            { key: 'health', label: '🖥️ System Health' },
            { key: 'announce', label: '📢 Announcements' },
            { key: 'company', label: '⚙️ Platform Settings' },
            { key: 'activity', label: '📋 Activity Log' },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '10px 18px', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, color: activeTab === tab.key ? '#1A3560' : '#9CA3AF', borderBottom: activeTab === tab.key ? '2px solid #C9A227' : '2px solid transparent', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: -1 }}>{tab.label}</button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Total Tenants', value: tenants.length, icon: FiServer, color: '#1A3560' },
                { label: 'Active', value: tenants.filter((t) => t.status === 'active').length, icon: FiCheckCircle, color: '#16A34A' },
                { label: 'On Trial', value: tenants.filter((t) => t.plan === 'trial').length, icon: FiAlertCircle, color: '#D97706' },
                { label: 'Suspended', value: tenants.filter((t) => t.status === 'suspended').length, icon: FiXCircle, color: '#DC2626' },
                { label: 'MRR (GHS)', value: monthlyRevenue.toLocaleString(), icon: FiDollarSign, color: '#C9A227' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', borderLeft: `4px solid ${s.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                      <p style={{ fontSize: 26, fontWeight: 800, color: '#1A3560' }}>{s.value}</p>
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <s.icon size={18} color={s.color} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', marginBottom: 16 }}>Tenants by Plan</h3>
              {tenants.length === 0 ? <p style={{ color: '#9CA3AF', fontSize: 13 }}>No tenants yet.</p> : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(tenants.reduce((acc, t) => { acc[t.plan] = (acc[t.plan] || 0) + 1; return acc; }, {})).map(([plan, count]) => (
                    <div key={plan} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: `${planColor[plan] || '#6B7280'}15`, border: `1px solid ${planColor[plan] || '#6B7280'}30` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: planColor[plan] || '#6B7280' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: '#1A3560' }}>{plan}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: planColor[plan] || '#6B7280' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tenants ───────────────────────────────────────────────────────────── */}
        {activeTab === 'tenants' && (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', margin: 0 }}>All Tenants</h3>
              <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 12px', flex: 1, minWidth: 180 }}>
                  <FiSearch size={14} color="#9CA3AF" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, subdomain, email..."
                    style={{ border: 'none', background: 'transparent', fontSize: 13, outline: 'none', width: '100%' }} />
                </div>
                <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }}>
                  <option value="">All Plans</option>
                  {['trial', 'starter', 'professional', 'enterprise', 'founding'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }}>
                  <option value="">All Statuses</option>
                  {['active', 'trial', 'suspended', 'expired', 'founding'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddTenantModal(true)}
                style={{ padding: '8px 18px', borderRadius: 8, background: '#C9A227', color: '#1A3560', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                + Add Tenant
              </motion.button>
              <span style={{ fontSize: 13, color: '#9CA3AF', flexShrink: 0 }}>{filtered.length} tenants</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #E2E8F0' }}>
                    {['Company', 'Subdomain', 'Owner', 'Plan', 'Status', 'Expires', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: ['Plan', 'Status', 'Expires', 'Actions'].includes(h) ? 'center' : 'left', fontWeight: 600, color: '#6B7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No tenants match filters.</td></tr>
                  ) : filtered.map((t, i) => (
                    <tr key={t._id} style={{ borderBottom: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A3560' }}>
                        <button onClick={() => setSelectedTenant(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: '#1A3560', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {t.companyName} <FiUser size={12} color="#9CA3AF" />
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#2563EB' }}>{t.subdomain}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13 }}>{t.owner?.name}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{t.owner?.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <select value={t.plan} disabled={t.plan === 'founding' || changingPlan === t.subdomain}
                          onChange={(e) => handlePlanChange(t.subdomain, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${planColor[t.plan] || '#6B7280'}40`, fontSize: 11, fontWeight: 700, background: `${planColor[t.plan] || '#6B7280'}10`, color: planColor[t.plan] || '#6B7280', cursor: t.plan === 'founding' ? 'not-allowed' : 'pointer', textTransform: 'capitalize' }}>
                          {['trial', 'starter', 'professional', 'enterprise', 'founding'].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', background: `${statusColor[t.status] || '#6B7280'}15`, color: statusColor[t.status] || '#6B7280' }}>{t.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#6B7280' }}>
                        {t.subscription?.expiryDate ? new Date(t.subscription.expiryDate).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
    onClick={() => t.status === 'suspended' ? handleReactivate(t.subdomain) : handleSuspend(t.subdomain)}
    disabled={actionLoading === t.subdomain}
    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: t.status === 'suspended' ? '1px solid #A7F3D0' : '1px solid #FECACA', background: t.status === 'suspended' ? '#D1FAE5' : '#FEE2E2', color: t.status === 'suspended' ? '#065F46' : '#DC2626' }}>
    {t.status === 'suspended' ? '✅ Activate' : '🚫 Deactivate'}
  </motion.button>
  {t.plan !== 'founding' && (
    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
      onClick={async () => {
        if (!window.confirm(`⚠️ PERMANENTLY DELETE "${t.companyName}"?\n\nThis will delete ALL their data including accounts, invoices, journals, users, and settings.\n\nThis action CANNOT be undone. Type the subdomain to confirm.`)) return;
        const confirm = window.prompt(`Type "${t.subdomain}" to confirm permanent deletion:`);
        if (confirm !== t.subdomain) { alert('Subdomain did not match. Deletion cancelled.'); return; }
        setActionLoading(t.subdomain);
        try {
          const { data } = await platformApi.delete(`/tenants/${t.subdomain}`);
          if (data.success) { alert('✅ Tenant deleted permanently.'); fetchAll(); }
          else alert('Failed: ' + data.message);
        } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
        finally { setActionLoading(''); }
      }}
      disabled={actionLoading === t.subdomain}
      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #DC2626', background: '#fff', color: '#DC2626' }}>
      🗑 Delete
    </motion.button>
  )}
</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Revenue ───────────────────────────────────────────────────────────── */}
        {activeTab === 'revenue' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Monthly Recurring Revenue', value: `GHS ${monthlyRevenue.toLocaleString()}`, color: '#16A34A' },
                { label: 'Annual Run Rate', value: `GHS ${(monthlyRevenue * 12).toLocaleString()}`, color: '#2563EB' },
                { label: 'Paying Tenants', value: tenants.filter((t) => ['starter','professional','enterprise'].includes(t.plan) && t.status === 'active' && t.subscription?.lastPaymentRef).length, color: '#C9A227' },                { label: 'Trial Tenants', value: tenants.filter((t) => t.plan === 'trial').length, color: '#D97706' },
                { label: 'Expiring in 7 Days', value: tenants.filter((t) => { if (!t.subscription?.expiryDate) return false; const d = (new Date(t.subscription.expiryDate) - new Date()) / 86400000; return d >= 0 && d <= 7; }).length, color: '#DC2626' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', borderLeft: `4px solid ${s.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: '#1A3560' }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', marginBottom: 16 }}>Revenue by Plan</h3>
              {[{ plan: 'starter', price: 300, color: '#2563EB' }, { plan: 'professional', price: 990, color: '#C9A227' }, { plan: 'enterprise', price: 2400, color: '#1A3560' }].map((p) => {
               const count = tenants.filter((t) => t.plan === p.plan && t.status === 'active' && t.subscription?.lastPaymentRef).length;                return (
                  <div key={p.plan} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, padding: '10px 16px', background: '#F8FAFF', borderRadius: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3560', width: 120, textTransform: 'capitalize' }}>{p.plan}</span>
                    <span style={{ fontSize: 13, color: '#6B7280' }}>{count} tenant{count !== 1 ? 's' : ''} × GHS {p.price.toLocaleString()}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: p.color }}>GHS {(count * p.price).toLocaleString()}/mo</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Health ────────────────────────────────────────────────────────────── */}
        {activeTab === 'health' && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: 24 }}>
              <motion.button whileHover={{ scale: 1.02 }} onClick={fetchHealth} disabled={healthLoading}
                style={{ padding: '10px 22px', borderRadius: 8, background: '#1A3560', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                {healthLoading ? '⏳ Checking...' : '🔍 Run Health Check'}
              </motion.button>
            </div>
            {healthData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'API Status', value: healthData.status === 'healthy' ? '✅ Online' : '❌ Down', color: healthData.status === 'healthy' ? '#16A34A' : '#DC2626' },
                  { label: 'Response Time', value: healthData.ping ? `${healthData.ping}ms` : 'N/A', color: (healthData.ping || 0) < 300 ? '#16A34A' : '#D97706' },
                  { label: 'Environment', value: healthData.environment || 'unknown', color: '#2563EB' },
                  { label: 'Total Tenants', value: tenants.length, color: '#1A3560' },
                  { label: 'Active', value: tenants.filter((t) => t.status === 'active').length, color: '#16A34A' },
                  { label: 'Suspended', value: tenants.filter((t) => t.status === 'suspended').length, color: '#DC2626' },
                ].map((s, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #E2E8F0' }}>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase' }}>{s.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
            {!healthData && <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#9CA3AF', border: '1px solid #E2E8F0' }}>Click "Run Health Check" to see system status</div>}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', marginBottom: 16 }}>⚠️ Expiring Within 7 Days</h3>
              {tenants.filter((t) => { if (!t.subscription?.expiryDate) return false; const d = (new Date(t.subscription.expiryDate) - new Date()) / 86400000; return d >= 0 && d <= 7; }).length === 0
                ? <p style={{ color: '#9CA3AF', fontSize: 13 }}>No tenants expiring within 7 days. ✅</p>
                : tenants.filter((t) => { if (!t.subscription?.expiryDate) return false; const d = (new Date(t.subscription.expiryDate) - new Date()) / 86400000; return d >= 0 && d <= 7; }).map((t) => (
                  <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FEF3C7', borderRadius: 8, marginBottom: 8, border: '1px solid #FDE68A' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{t.companyName} <span style={{ fontWeight: 400, color: '#6B7280' }}>({t.subdomain})</span></span>
                    <span style={{ fontSize: 12, color: '#D97706', fontWeight: 600 }}>{new Date(t.subscription.expiryDate).toLocaleDateString('en-GB')}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── Announcements ─────────────────────────────────────────────────────── */}
        {activeTab === 'announce' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', marginBottom: 6 }}>Broadcast Announcement</h3>
              <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Posts to <strong>all {tenants.length} tenants</strong> simultaneously in their Announcements section.</p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>TITLE *</label>
                <input value={announcement.title} onChange={(e) => setAnnouncement((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. System Maintenance on Saturday" style={{ width: '100%', padding: '11px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>MESSAGE *</label>
                <textarea value={announcement.message} onChange={(e) => setAnnouncement((p) => ({ ...p, message: e.target.value }))} rows={5} placeholder="Write your message here..." style={{ width: '100%', padding: '11px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>TYPE</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['info', 'warning', 'success'].map((type) => (
                    <button key={type} onClick={() => setAnnouncement((p) => ({ ...p, type }))} style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${announcement.type === type ? '#1A3560' : '#E2E8F0'}`, background: announcement.type === type ? '#1A3560' : '#fff', color: announcement.type === type ? '#fff' : '#6B7280', textTransform: 'capitalize' }}>
                      {type === 'info' ? 'ℹ️' : type === 'warning' ? '⚠️' : '✅'} {type}
                    </button>
                  ))}
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleBroadcast} disabled={announceSending}
                style={{ width: '100%', padding: '13px', borderRadius: 10, background: announceSending ? '#9CA3AF' : 'linear-gradient(135deg, #C9A227, #e0b930)', color: '#1A3560', fontSize: 14, fontWeight: 700, border: 'none', cursor: announceSending ? 'not-allowed' : 'pointer' }}>
                {announceSending ? '⏳ Sending...' : `📢 Broadcast to All ${tenants.length} Tenants`}
              </motion.button>
            </div>
          </div>
        )}

        {/* ── Platform Settings ─────────────────────────────────────────────────── */}
        {activeTab === 'company' && <CompanyInfoSettings />}

        {/* ── Activity Log ──────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div style={{ maxWidth: 760 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', marginBottom: 6 }}>Console Activity Log</h3>
              <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Recent actions taken in the developer console during this session.</p>
              <div style={{ padding: '16px', background: '#F8FAFF', borderRadius: 10, border: '1px solid #E2E8F0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                Activity logging across sessions requires a backend log collection. All actions in this console session (plan changes, suspensions, tenant creation) are recorded in your MongoDB audit logs per tenant. To see full history, check the Audit Log inside each tenant's dashboard.
              </div>
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1A3560', marginBottom: 12 }}>Current Session Summary</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Tenants Loaded', value: tenants.length },
                    { label: 'Active Tenants', value: tenants.filter((t) => t.status === 'active').length },
                    { label: 'Suspended', value: tenants.filter((t) => t.status === 'suspended').length },
                    { label: 'Total MRR', value: `GHS ${monthlyRevenue.toLocaleString()}` },
                  ].map((s, i) => (
                    <div key={i} style={{ padding: '14px', background: '#F8FAFF', borderRadius: 10, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#1A3560' }}>{s.value}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Tenant Modal ────────────────────────────────────────────────────── */}
      {showAddTenantModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setShowAddTenantModal(false); setAddTenantError(''); }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A3560', marginBottom: 6 }}>Add New Tenant</h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>Manually provision a tenant. Use for Enterprise clients you onboard directly.</p>

            {addTenantError && <div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>{addTenantError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>COMPANY NAME *</label>
                <input value={addTenantForm.companyName}
                  onChange={(e) => { const name = e.target.value; const sub = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); setAddTenantForm((p) => ({ ...p, companyName: name, subdomain: sub })); }}
                  placeholder="Essence Kapital Engineering Ltd"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>SUBDOMAIN *</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                  <input value={addTenantForm.subdomain} onChange={(e) => setAddTenantForm((p) => ({ ...p, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} style={{ flex: 1, padding: '10px 14px', border: 'none', fontSize: 14, outline: 'none' }} />
                  <span style={{ padding: '10px 14px', background: '#F8FAFF', fontSize: 12, color: '#6B7280', borderLeft: '1px solid #E2E8F0' }}>.nexusorabooks.com</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>OWNER NAME *</label>
                <input value={addTenantForm.ownerName} onChange={(e) => setAddTenantForm((p) => ({ ...p, ownerName: e.target.value }))} placeholder="Full name" style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>OWNER EMAIL *</label>
                <input type="email" value={addTenantForm.ownerEmail} onChange={(e) => setAddTenantForm((p) => ({ ...p, ownerEmail: e.target.value }))} placeholder="owner@company.com" style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>PHONE</label>
                <input value={addTenantForm.ownerPhone} onChange={(e) => setAddTenantForm((p) => ({ ...p, ownerPhone: e.target.value }))} placeholder="+233..." style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>PLAN *</label>
                <select value={addTenantForm.plan} onChange={(e) => setAddTenantForm((p) => ({ ...p, plan: e.target.value }))} style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none' }}>
                  {['trial', 'starter', 'professional', 'enterprise', 'founding'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1A3560', marginBottom: 12 }}>ADMIN USER ACCOUNT</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>FIRST NAME *</label><input value={addTenantForm.adminFirstName} onChange={(e) => setAddTenantForm((p) => ({ ...p, adminFirstName: e.target.value }))} placeholder="John" style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>LAST NAME *</label><input value={addTenantForm.adminLastName} onChange={(e) => setAddTenantForm((p) => ({ ...p, adminLastName: e.target.value }))} placeholder="Mensah" style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>ADMIN EMAIL *</label><input type="email" value={addTenantForm.adminEmail} onChange={(e) => setAddTenantForm((p) => ({ ...p, adminEmail: e.target.value }))} placeholder="admin@company.com" style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>TEMP PASSWORD *</label><input type="password" value={addTenantForm.adminPassword} onChange={(e) => setAddTenantForm((p) => ({ ...p, adminPassword: e.target.value }))} placeholder="Min 8 characters" style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} /></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowAddTenantModal(false); setAddTenantError(''); }} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} disabled={addTenantLoading}
                onClick={async () => {
                  const f = addTenantForm;
                  if (!f.companyName || !f.subdomain || !f.ownerName || !f.ownerEmail || !f.adminEmail || !f.adminPassword) { setAddTenantError('Fill in all required fields.'); return; }
                  if (f.adminPassword.length < 8) { setAddTenantError('Password must be at least 8 characters.'); return; }
                  setAddTenantLoading(true); setAddTenantError('');
                  try {
                    const { data } = await platformApi.post('/tenants/provision', { subdomain: f.subdomain, companyName: f.companyName, plan: f.plan, owner: { name: f.ownerName, email: f.ownerEmail, phone: f.ownerPhone }, adminUser: { firstName: f.adminFirstName, lastName: f.adminLastName, email: f.adminEmail, password: f.adminPassword } });
                    if (data.success) {
                      setShowAddTenantModal(false);
                      setAddTenantForm({ companyName: '', subdomain: '', ownerName: '', ownerEmail: '', ownerPhone: '', plan: 'enterprise', adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '' });
                      fetchAll();
                      alert(`✅ Tenant created!\nURL: ${f.subdomain}.nexusorabooks.com\nAdmin: ${f.adminEmail}`);
                    } else { setAddTenantError(data.message || 'Failed.'); }
                  } catch (err) { setAddTenantError(err.response?.data?.message || 'Failed to create tenant.'); }
                  finally { setAddTenantLoading(false); }
                }}
                style={{ flex: 2, padding: '11px', borderRadius: 8, background: addTenantLoading ? '#9CA3AF' : '#1A3560', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: addTenantLoading ? 'not-allowed' : 'pointer' }}>
                {addTenantLoading ? '⏳ Creating...' : '✅ Provision Tenant'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Tenant Detail Modal ──────────────────────────────────────────────────── */}
      {selectedTenant && (
        <TenantDetailModal
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onRefresh={() => { fetchAll(); setSelectedTenant(null); }}
        />
      )}
    </div>
  );
}