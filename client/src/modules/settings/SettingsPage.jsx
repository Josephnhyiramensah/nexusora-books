import { useState, useEffect } from 'react';
import {
  FiUser,
  FiShield,
  FiGlobe,
  FiUsers,
  FiPlus,
  FiEdit2,
  FiToggleLeft,
  FiToggleRight,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { FiCode } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { FiEdit3 } from 'react-icons/fi';   // if not already imported

// ---------- Styles ----------
const styles = {
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 24,
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
  },
  tab: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--deep-navy)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--nexusora-gold)' : '2px solid transparent',
    background: 'transparent',
    marginBottom: -1,
    cursor: 'pointer',
  }),
  card: {
    background: '#fff',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    padding: 28,
  },
  inputStyle: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    outline: 'none',
  },
  labelStyle: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  buttonPrimary: {
    padding: '11px 28px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--nexusora-gold)',
    color: 'var(--deep-navy)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
  },
};

// ---------- Sub-components ----------

function ProfileTab({ user, plan }) {
  return (
    <div style={{ ...styles.card, maxWidth: 600 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>My Profile</h2>
      {/* Letterhead Image Upload */}
      
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>        <div>
          <label style={styles.labelStyle}>First Name</label>
          <input style={styles.inputStyle} value={user?.firstName || ''} disabled />
        </div>
        <div>
          <label style={styles.labelStyle}>Last Name</label>
          <input style={styles.inputStyle} value={user?.lastName || ''} disabled />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={styles.labelStyle}>Email</label>
        <input style={styles.inputStyle} value={user?.email || ''} disabled />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={styles.labelStyle}>Role</label>
        <input style={styles.inputStyle} value={user?.role?.replace('_', ' ')} disabled />
      </div>
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-app)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        Plan: <strong style={{ textTransform: 'capitalize' }}>{plan || 'trial'}</strong> — Contact
        your administrator to update profile details.
      </div>
    </div>
  );
}

function CompanyTab({
  companyName,
  subdomain,
  companyForm,
  setCompanyForm,
  handleLogoUpload,
  handleSaveCompany,
  showToast,
}) {
  return (
    <div style={{ ...styles.card, maxWidth: 700 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Company Information</h2>

      {/* Logo Upload */}
      <div
        style={{
          marginBottom: 28,
          padding: 20,
          background: 'var(--bg-app)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border)',
        }}
      >
        <label style={{ ...styles.labelStyle, marginBottom: 14 }}>Company Logo</label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          This logo replaces the "N" icon on the dashboard and top bar. Recommended: square PNG or
          JPG, at least 200×200px.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Logo Preview */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              flexShrink: 0,
              background: companyForm.logo
                ? 'transparent'
                : 'linear-gradient(135deg, var(--nexusora-gold), #e0b930)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 36,
              color: 'var(--deep-navy)',
              border: '2px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            {companyForm.logo ? (
              <img
                src={companyForm.logo}
                alt="Company logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              companyName?.[0] || 'N'
            )}
          </div>

          {/* Upload Controls */}
          <div style={{ flex: 1 }}>
            <input
              type="file"
              id="logo-upload"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <motion.label
                htmlFor="logo-upload"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--deep-navy)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📁 Choose Logo File
              </motion.label>

              {companyForm.logo && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCompanyForm((prev) => ({ ...prev, logo: '' }));
                    showToast('Logo removed — click Save to apply');
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger)',
                    background: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  🗑 Remove Logo
                </motion.button>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              PNG, JPG, SVG, or WebP — max 2MB. Works on laptop, desktop, and mobile.
            </p>
          </div>
        </div>
      </div>


      <div style={{ marginBottom: 28, padding: 20, background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
        <label style={{ ...styles.labelStyle, marginBottom: 6 }}>Official Letterhead Image</label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Upload your company letterhead as PNG or JPG. It replaces the navy header on all printed statements and invoices — your exact branded letterhead will appear.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 220, height: 65, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', background: '#F8FAFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {companyForm.letterheadImage ? (
              <img src={companyForm.letterheadImage} alt="Letterhead preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>No letterhead uploaded</span>
            )}
          </div>
          <div>
            <input type="file" id="letterhead-upload" accept="image/png,image/jpeg,image/jpg"
              style={{ display: 'none' }}
            onChange={async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast('Letterhead must be under 10MB', 'error'); return; }
  showToast('Compressing and uploading letterhead...');
  try {
    // Compress image using canvas before uploading
    const compressedBase64 = await new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        // Max width 1200px for letterhead — enough for A4 quality
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Compress to JPEG at 80% quality
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = reject;
      img.src = objectUrl;
    });

    console.log('[Letterhead] Compressed size:', Math.round(compressedBase64.length / 1024), 'KB');

    const { data } = await api.post('/upload/letterhead', {
      imageData: compressedBase64,
      subdomain: subdomain,
    });

    if (data.success) {
      setCompanyForm((prev) => ({ ...prev, letterheadImage: data.url }));
      showToast('✅ Letterhead uploaded — click Save Company Settings to apply');
    }
  } catch (err) {
    showToast(err.response?.data?.message || 'Upload failed', 'error');
  }
}}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <motion.label htmlFor="letterhead-upload" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-sm)', background: 'var(--deep-navy)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📄 Upload Letterhead
              </motion.label>
              {companyForm.letterheadImage && (
                <motion.button type="button" whileHover={{ scale: 1.02 }} onClick={() => { setCompanyForm((prev) => ({ ...prev, letterheadImage: '' })); showToast('Letterhead removed'); }}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger)', color: 'var(--danger)', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  🗑 Remove
                </motion.button>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>PNG or JPG — max 5MB. After uploading click Save Company Settings.</p>
          </div>
        </div>
      </div>

      {/* Company Info Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={styles.labelStyle}>Company Name</label>
          <input style={styles.inputStyle} value={companyName || ''} disabled />
        </div>
        <div>
          <label style={styles.labelStyle}>Subdomain</label>
          <input style={styles.inputStyle} value={`${subdomain}.nexusorabooks.com`} disabled />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={styles.labelStyle}>Address</label>
          <input
            style={styles.inputStyle}
            value={companyForm.address}
            onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
            placeholder="Street address"
          />
        </div>
        <div>
          <label style={styles.labelStyle}>City</label>
          <input
            style={styles.inputStyle}
            value={companyForm.city}
            onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
            placeholder="Kumasi"
          />
        </div>
        <div>
          <label style={styles.labelStyle}>Region</label>
          <input
            style={styles.inputStyle}
            value={companyForm.region}
            onChange={(e) => setCompanyForm({ ...companyForm, region: e.target.value })}
            placeholder="Ashanti"
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={styles.labelStyle}>Tax ID (TIN)</label>
        <input
          style={styles.inputStyle}
          value={companyForm.taxId}
          onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
          placeholder="GRA TIN"
        />
      </div>

      {/* Letterhead */}
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginTop: 28,
          marginBottom: 16,
          paddingTop: 20,
          borderTop: '1px solid var(--border)',
        }}
      >
        Letterhead & Print Settings
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        These details appear on printed invoices, reports, and official documents.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={styles.labelStyle}>Company Name (on letterhead)</label>
          <input
            style={styles.inputStyle}
            value={companyForm.letterhead.companyName}
            onChange={(e) =>
              setCompanyForm({
                ...companyForm,
                letterhead: { ...companyForm.letterhead, companyName: e.target.value },
              })
            }
          />
        </div>
        <div>
          <label style={styles.labelStyle}>Tagline</label>
          <input
            style={styles.inputStyle}
            value={companyForm.letterhead.tagline}
            onChange={(e) =>
              setCompanyForm({
                ...companyForm,
                letterhead: { ...companyForm.letterhead, tagline: e.target.value },
              })
            }
            placeholder="Your company motto"
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={styles.labelStyle}>Address (on letterhead)</label>
        <input
          style={styles.inputStyle}
          value={companyForm.letterhead.address}
          onChange={(e) =>
            setCompanyForm({
              ...companyForm,
              letterhead: { ...companyForm.letterhead, address: e.target.value },
            })
          }
          placeholder="Full address for documents"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={styles.labelStyle}>Phone</label>
          <input
            style={styles.inputStyle}
            value={companyForm.letterhead.phone}
            onChange={(e) =>
              setCompanyForm({
                ...companyForm,
                letterhead: { ...companyForm.letterhead, phone: e.target.value },
              })
            }
          />
        </div>
        <div>
          <label style={styles.labelStyle}>Email</label>
          <input
            style={styles.inputStyle}
            value={companyForm.letterhead.email}
            onChange={(e) =>
              setCompanyForm({
                ...companyForm,
                letterhead: { ...companyForm.letterhead, email: e.target.value },
              })
            }
          />
        </div>
        <div>
          <label style={styles.labelStyle}>Website</label>
          <input
            style={styles.inputStyle}
            value={companyForm.letterhead.website}
            onChange={(e) =>
              setCompanyForm({
                ...companyForm,
                letterhead: { ...companyForm.letterhead, website: e.target.value },
              })
            }
          />
        </div>
      </div>

      <button onClick={handleSaveCompany} style={styles.buttonPrimary}>
        Save Company Settings
      </button>
    </div>
  );
}

function UsersTab({
  users,
  plan,
  subdomain,
  userModalOpen,
  setUserModalOpen,
  editingUser,
  setEditingUser,
  handleCreateUser,
  handleToggleUser,
  showToast,
  labelStyle,
  inputStyle,
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {users.length} users — Plan limit:{' '}
          {plan === 'founding' || plan === 'enterprise' ? 'Unlimited' : `check subscription`}
        </p>
        <button
          onClick={() => {
            setEditingUser(null);
            setUserModalOpen(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 18px',
            background: 'var(--nexusora-gold)',
            color: 'var(--deep-navy)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <FiPlus size={14} /> Add User
        </button>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr
                key={u._id}
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                }}
              >
                <td style={{ padding: '11px 16px', fontWeight: 500 }}>
                  {u.firstName} {u.lastName}
                </td>
                <td style={{ padding: '11px 16px' }}>{u.email}</td>
                <td style={{ padding: '11px 16px', textTransform: 'capitalize' }}>
                  {u.role?.replace('_', ' ')}
                </td>
                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: u.isActive ? '#D1FAE5' : '#FEE2E2',
                      color: u.isActive ? '#065F46' : '#991B1B',
                    }}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setUserModalOpen(true);
                      }}
                      style={{ padding: '4px 8px', color: 'var(--tech-blue)', cursor: 'pointer', background: 'none', border: 'none' }}
                    >
                      <FiEdit2 size={13} />
                    </button>
                    {u.role !== 'super_admin' && (
                      <button
                        onClick={() => handleToggleUser(u._id)}
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        style={{
                          padding: '4px 8px',
                          color: u.isActive ? 'var(--danger)' : 'var(--success)',
                          cursor: 'pointer',
                          background: 'none',
                          border: 'none',
                        }}
                      >
                        {u.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        title={editingUser ? 'Edit User' : 'Add User'}
      >
        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input name="firstName" style={inputStyle} defaultValue={editingUser?.firstName || ''} required />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input name="lastName" style={inputStyle} defaultValue={editingUser?.lastName || ''} required />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email *</label>
            <input
              name="email"
              type="email"
              style={inputStyle}
              defaultValue={editingUser?.email || ''}
              required
              disabled={!!editingUser}
            />
          </div>
          {!editingUser && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Password *</label>
              <input
                name="password"
                type="password"
                style={inputStyle}
                required
                minLength={8}
                placeholder="Min 8 characters"
              />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Role *</label>
              <select name="role" style={inputStyle} defaultValue={editingUser?.role || 'staff'}>
                <option value="admin">Admin</option>
                <option value="accountant">Accountant</option>
                <option value="staff">Staff</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input name="phone" style={inputStyle} defaultValue={editingUser?.phone || ''} />
            </div>
          </div>
          {!editingUser && (
            <div
              style={{
                padding: '12px 16px',
                background: '#FEF3C7',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 20,
                fontSize: 13,
                color: '#92400E',
              }}
            >
              The user will log in at <strong>{subdomain}.nexusorabooks.com</strong> with their email
              and the password you set here. They should change it on first login.
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setUserModalOpen(false);
                setEditingUser(null);
              }}
              style={{
                padding: '10px 22px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                fontSize: 14,
                color: 'var(--text-secondary)',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 22px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--nexusora-gold)',
                color: 'var(--deep-navy)',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {editingUser ? 'Update' : 'Create'} User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SecurityTab({ showToast, labelStyle, inputStyle }) {
  return (
    <div style={{ ...styles.card, maxWidth: 600 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Change Password</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const currentPassword = fd.get('currentPassword');
          const newPassword = fd.get('newPassword');
          const confirm = fd.get('confirmPassword');
          if (newPassword !== confirm) {
            showToast('Passwords do not match', 'error');
            return;
          }
          try {
            const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
            if (data.success) {
              showToast('Password changed');
              e.target.reset();
            }
          } catch (err) {
            showToast(err.response?.data?.message || 'Failed', 'error');
          }
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Current Password</label>
          <input type="password" name="currentPassword" style={inputStyle} required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>New Password</label>
          <input type="password" name="newPassword" style={inputStyle} required minLength={8} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Confirm New Password</label>
          <input type="password" name="confirmPassword" style={inputStyle} required minLength={8} />
        </div>
        <button
          type="submit"
          style={{
            padding: '10px 22px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--tech-blue)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Change Password
        </button>
      </form>
    </div>
  );
}


// ─── API Keys Manager ──────────────────────────────────────────────────────
function ApiKeysManager({ subdomain }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null);
  const [form, setForm] = useState({ name: '', permissions: ['read'], expiresInDays: '' });
  const { showToast } = useToast();

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api-keys');
      if (data.success) setKeys(data.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    try {
      const { data } = await api.post('/api-keys', form);
      if (data.success) {
        setNewKeyData(data.data); // Show the raw key once
        fetchKeys();
        setCreating(false);
        setForm({ name: '', permissions: ['read'], expiresInDays: '' });
      }
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleRevoke = async (id, name) => {
    if (!window.confirm(`Revoke API key "${name}"? All apps using this key will stop working immediately.`)) return;
    try {
      await api.delete(`/api-keys/${id}/revoke`);
      showToast('API key revoked');
      fetchKeys();
    } catch { showToast('Failed', 'error'); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>API Keys</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Use these keys to connect external applications. Keys are shown only once at creation.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{ padding: '10px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          + Create Key
        </button>
      </div>

      {/* New key revealed */}
      {newKeyData && (
        <div style={{ padding: 20, background: '#D1FAE5', border: '2px solid #16A34A', borderRadius: 12, marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#065F46', marginBottom: 8 }}>✅ API Key Created — Copy it now!</p>
          <p style={{ fontSize: 12, color: '#065F46', marginBottom: 12 }}>This key will never be shown again. Store it securely.</p>
          <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', border: '1px solid #A7F3D0', marginBottom: 10 }}>
            {newKeyData.key}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(newKeyData.key); showToast('Key copied!'); }}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#16A34A', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', marginRight: 8 }}>
            📋 Copy Key
          </button>
          <button onClick={() => setNewKeyData(null)} style={{ padding: '8px 16px', borderRadius: 8, background: '#fff', border: '1px solid #A7F3D0', color: '#065F46', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            I've saved it — close
          </button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>New API Key</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Key Name *</label><input style={inputStyle} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. My Website Integration" /></div>
            <div><label style={labelStyle}>Expires (days, optional)</label><input type="number" style={inputStyle} value={form.expiresInDays} onChange={(e) => setForm((p) => ({ ...p, expiresInDays: e.target.value }))} placeholder="Leave blank = no expiry" /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Permissions</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['read', 'write', 'invoices', 'journals', 'reports', 'payroll'].map((perm) => (
                <button key={perm} onClick={() => setForm((p) => ({
                  ...p,
                  permissions: p.permissions.includes(perm)
                    ? p.permissions.filter((x) => x !== perm)
                    : [...p.permissions, perm],
                }))} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${form.permissions.includes(perm) ? 'var(--tech-blue)' : 'var(--border)'}`,
                  background: form.permissions.includes(perm) ? '#DBEAFE' : '#fff',
                  color: form.permissions.includes(perm) ? 'var(--tech-blue)' : 'var(--text-muted)',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {form.permissions.includes(perm) ? '✓ ' : ''}{perm}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleCreate} disabled={!form.name}
              style={{ padding: '10px 22px', borderRadius: 8, background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, border: 'none', cursor: form.name ? 'pointer' : 'not-allowed' }}>
              Generate Key
            </button>
            <button onClick={() => setCreating(false)} style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading keys...</p> :
      keys.length === 0 ? <p style={{ color: 'var(--text-muted)', padding: 20 }}>No API keys yet. Create one to connect external systems.</p> :
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {keys.map((key, i) => (
          <div key={key._id} style={{ padding: '14px 18px', borderBottom: i < keys.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{key.name}</p>
              <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{key.keyPrefix}</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                {key.permissions.map((p) => <span key={p} style={{ padding: '1px 8px', borderRadius: 10, background: '#DBEAFE', color: '#1E40AF', fontWeight: 600, textTransform: 'capitalize' }}>{p}</span>)}
                {key.lastUsed && <span>Last used: {new Date(key.lastUsed).toLocaleDateString('en-GB')}</span>}
                {key.requestCount > 0 && <span>{key.requestCount} requests</span>}
                {key.expiresAt && <span style={{ color: new Date() > new Date(key.expiresAt) ? 'var(--danger)' : 'inherit' }}>Expires: {new Date(key.expiresAt).toLocaleDateString('en-GB')}</span>}
              </div>
            </div>
            <button onClick={() => handleRevoke(key._id, key.name)}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--danger)', background: '#FEE2E2', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              Revoke
            </button>
          </div>
        ))}
      </div>}

      {/* API documentation */}
      <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-app)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📖 How to use your API key</h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Include the key in your request header:</p>
        <div style={{ background: '#1A3560', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#C9A227', marginBottom: 12 }}>
          {`Authorization: Bearer nbk_${subdomain}_your_key_here`}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Available endpoints:</p>
        {[
          { method: 'GET',  endpoint: `/external/v1/invoices`,           desc: 'List all invoices' },
          { method: 'GET',  endpoint: `/external/v1/customers`,          desc: 'List all customers' },
          { method: 'GET',  endpoint: `/external/v1/accounts`,           desc: 'Chart of accounts' },
          { method: 'GET',  endpoint: `/external/v1/reports/trial-balance`, desc: 'Trial balance' },
          { method: 'POST', endpoint: `/external/v1/journals`,           desc: 'Create journal entry (write permission)' },
        ].map((ep, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: ep.method === 'GET' ? '#D1FAE5' : '#DBEAFE', color: ep.method === 'GET' ? '#065F46' : '#1E40AF', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>{ep.method}</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', flex: 1 }}>{ep.endpoint}</span>
            <span style={{ color: 'var(--text-muted)' }}>{ep.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── White-label Settings ──────────────────────────────────────────────────
function WhiteLabelSettings({ subdomain, currentSettings, onSave }) {
  const [form, setForm] = useState({
    whiteLabel: {
      enabled: currentSettings?.whiteLabel?.enabled || false,
      brandName: currentSettings?.whiteLabel?.brandName || '',
      brandTagline: currentSettings?.whiteLabel?.brandTagline || '',
      primaryColor: currentSettings?.whiteLabel?.primaryColor || '#1A3560',
      accentColor: currentSettings?.whiteLabel?.accentColor || '#C9A227',
      customDomain: currentSettings?.whiteLabel?.customDomain || '',
      hidePoweredBy: currentSettings?.whiteLabel?.hidePoweredBy || false,
    },
  });
  const { showToast } = useToast();

  const handleSave = async () => {
    try {
      await onSave({ ...currentSettings, ...form });
    } catch { showToast('Failed to save white-label settings', 'error'); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', padding: 24, maxWidth: 640 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>White-label Settings</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Customise how Nexusora Books appears to your clients. These settings override the default Nexusora branding.
      </p>

      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg-app)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Enable White-label</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Replace Nexusora Books branding with your own</p>
        </div>
        <button onClick={() => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, enabled: !p.whiteLabel.enabled } }))}
          style={{
            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: form.whiteLabel.enabled ? 'var(--success)' : '#E5E7EB',
            transition: 'background 200ms', position: 'relative',
          }}>
          <div style={{
            position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'left 200ms',
            left: form.whiteLabel.enabled ? 25 : 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {form.whiteLabel.enabled && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Brand Name *</label><input style={inputStyle} value={form.whiteLabel.brandName} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, brandName: e.target.value } }))} placeholder="ABC Accountants Portal" /></div>
            <div><label style={labelStyle}>Tagline</label><input style={inputStyle} value={form.whiteLabel.brandTagline} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, brandTagline: e.target.value } }))} placeholder="Professional accounting for your business" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Primary Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.whiteLabel.primaryColor} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, primaryColor: e.target.value } }))}
                  style={{ width: 40, height: 38, borderRadius: 6, border: '1px solid var(--border)', padding: 2, cursor: 'pointer' }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.whiteLabel.primaryColor} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, primaryColor: e.target.value } }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Accent Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.whiteLabel.accentColor} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, accentColor: e.target.value } }))}
                  style={{ width: 40, height: 38, borderRadius: 6, border: '1px solid var(--border)', padding: 2, cursor: 'pointer' }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.whiteLabel.accentColor} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, accentColor: e.target.value } }))} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Custom Domain</label>
            <input style={inputStyle} value={form.whiteLabel.customDomain} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, customDomain: e.target.value } }))} placeholder="app.yourcompany.com" />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>After setting this, point a CNAME DNS record from this domain to {subdomain}.nexusorabooks.com — then contact us to enable SSL.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-app)', borderRadius: 8, marginBottom: 20, border: '1px solid var(--border)' }}>
            <input type="checkbox" id="hide-powered" checked={form.whiteLabel.hidePoweredBy} onChange={(e) => setForm((p) => ({ ...p, whiteLabel: { ...p.whiteLabel, hidePoweredBy: e.target.checked } }))} style={{ width: 16, height: 16 }} />
            <label htmlFor="hide-powered" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Hide "Powered by Nexusora Technologies" footer
            </label>
          </div>
        </>
      )}

      <button onClick={handleSave} style={{ padding: '11px 28px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
        Save White-label Settings
      </button>
    </div>
  );
}

// ---------- Main Component ----------
export default function SettingsPage() {
  const { user } = useAuth();
const { companyName, subdomain, settings, plan, updateSettings } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [users, setUsers] = useState([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const navigate = useNavigate();

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('Logo must be smaller than 2MB', 'error'); return; }

    showToast('Uploading logo...');
    try {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });

      const { data } = await api.post('/upload/logo', {
        imageData: base64,
        subdomain,
      });

      if (data.success) {
        setCompanyForm((prev) => ({ ...prev, logo: data.url }));
        showToast('✅ Logo uploaded — click Save Company Settings to apply');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Logo upload failed', 'error');
    }
  };
  const [companyForm, setCompanyForm] = useState({
    logo: settings?.logo || '',
    letterheadImage: settings?.letterheadImage || '',
    address: settings?.address || '',
    city: settings?.city || '',
    region: settings?.region || '',
    taxId: settings?.taxId || '',
    letterhead: {
      companyName: settings?.letterhead?.companyName || companyName || '',
      tagline: settings?.letterhead?.tagline || '',
      address: settings?.letterhead?.address || '',
      phone: settings?.letterhead?.phone || '',
      email: settings?.letterhead?.email || '',
      website: settings?.letterhead?.website || '',
    },
  });

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      if (data.success) setUsers(data.data);
    } catch {}
  };

  useEffect(() => {
    if (['super_admin', 'admin'].includes(user?.role)) fetchUsers();
  }, []);

  const handleSaveCompany = async (overrideForm) => {
    try {
      const payload = overrideForm || companyForm;

      // Strip base64 images before saving — only save Cloudinary URLs
      const cleanPayload = { ...payload };
      if (cleanPayload.logo && cleanPayload.logo.startsWith('data:')) {
        delete cleanPayload.logo; // Don't save base64 logo — upload it first via Choose Logo File
      }
      if (cleanPayload.letterheadImage && cleanPayload.letterheadImage.startsWith('data:')) {
        delete cleanPayload.letterheadImage;
      }

      const { data } = await api.put(`/tenants/${subdomain}/settings`, { settings: cleanPayload });
      if (data.success) {
        updateSettings(cleanPayload);
        showToast('Settings saved successfully');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed', 'error');
    }
  };
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      if (editingUser) {
        const { data } = await api.put(`/users/${editingUser._id}`, fd);
        if (data.success) showToast('User updated');
      } else {
        const { data } = await api.post('/users', fd);
        if (data.success) showToast(data.message);
      }
      setUserModalOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const handleToggleUser = async (id) => {
    try {
      const { data } = await api.patch(`/users/${id}/toggle-active`);
      if (data.success) {
        showToast(data.message);
        fetchUsers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const tabs = [
    { key: 'profile', label: 'My Profile', icon: FiUser },
    { key: 'company', label: 'Company & Letterhead', icon: FiGlobe },
    { key: 'users', label: 'Users & Roles', icon: FiUsers },
    { key: 'security', label: 'Security', icon: FiShield },
    
{ key: 'api', label: 'API Keys', icon: FiCode },
{ key: 'whitelabel', label: 'White-label', icon: FiEdit3 },
  ];

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  return (
    <div>
      {ToastComponent}
      <h1 style={styles.heading}>Settings</h1>

      <div style={styles.tabBar}>
        {tabs.map((tab) => {
          if (tab.key === 'users' && !isAdmin) return null;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={styles.tab(activeTab === tab.key)}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && <ProfileTab user={user} plan={plan} />}

      {activeTab === 'company' && (
        <CompanyTab
          companyName={companyName}
          subdomain={subdomain}
          companyForm={companyForm}
          setCompanyForm={setCompanyForm}
          handleLogoUpload={handleLogoUpload}
          handleSaveCompany={handleSaveCompany}
          showToast={showToast}
        />
      )}

      {activeTab === 'users' && isAdmin && (
        <UsersTab
          users={users}
          plan={plan}
          subdomain={subdomain}
          userModalOpen={userModalOpen}
          setUserModalOpen={setUserModalOpen}
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          handleCreateUser={handleCreateUser}
          handleToggleUser={handleToggleUser}
          showToast={showToast}
          labelStyle={styles.labelStyle}
          inputStyle={styles.inputStyle}
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          showToast={showToast}
          labelStyle={styles.labelStyle}
          inputStyle={styles.inputStyle}
        />
      )}
      {/* API Keys Tab */}
      {activeTab === 'api' && (
        <div>
          {/* Plan gate */}
          {!['enterprise', 'founding'].includes(plan) && (
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1A3560, #2E75B6)', borderRadius: 'var(--radius-md)', marginBottom: 24, color: '#fff' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>🔑 API Access — Enterprise Feature</h3>
              <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>
                Connect your external software, website, or mobile app to Nexusora Books. Available on Enterprise plan.
              </p>
              <button onClick={() => navigate('/upgrade')}
                style={{ padding: '10px 22px', borderRadius: 8, background: '#C9A227', color: '#1A3560', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Upgrade to Enterprise →
              </button>
            </div>
          )}

          {['enterprise', 'founding'].includes(plan) && (
            <ApiKeysManager subdomain={subdomain} />
          )}
        </div>
      )}

      {/* White-label Tab */}
      {activeTab === 'whitelabel' && (
        <div>
          {!['enterprise', 'founding'].includes(plan) && (
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1A3560, #2E75B6)', borderRadius: 'var(--radius-md)', color: '#fff' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>🎨 White-label — Enterprise Feature</h3>
              <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>
                Deploy Nexusora Books under your own brand name, colors, and custom domain. Available on Enterprise plan.
              </p>
              <button onClick={() => navigate('/upgrade')}
                style={{ padding: '10px 22px', borderRadius: 8, background: '#C9A227', color: '#1A3560', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Upgrade to Enterprise →
              </button>
            </div>
          )}

          {['enterprise', 'founding'].includes(plan) && (
            <WhiteLabelSettings
              subdomain={subdomain}
              currentSettings={companyForm}
              onSave={handleSaveCompany}
            />
          )}
        </div>
      )}
    </div>
  );
}