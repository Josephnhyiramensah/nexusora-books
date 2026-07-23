// client/src/components/common/TwoFactorNudge.jsx
// Session-dismissible prompt encouraging users to switch on 2FA. It reappears
// at the next sign-in until the account is enrolled, so it keeps nudging
// without blocking anyone — 2FA is optional by policy.

import { useState } from 'react';
import { FiShield, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const DISMISS_KEY = 'nexusora_2fa_nudge_dismissed';

export default function TwoFactorNudge({ user }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const navigate = useNavigate();

  if (!user || user.twoFactorEnabled || dismissed) return null;

  const close = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      margin: '14px 20px 0', padding: '12px 16px', background: '#FEF9E7',
      border: '1px solid #F5E6B3', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <FiShield size={18} color="#B8860B" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
          Your account is not protected by two-factor authentication
        </p>
        <p style={{ fontSize: 12, color: '#92400E' }}>
          Add a second step at sign-in using an authenticator app — it takes about a minute.
        </p>
      </div>
      <button type="button" onClick={() => navigate('/settings', { state: { tab: 'security' } })}
        style={{ padding: '8px 16px', borderRadius: 8, background: '#1A6B3C', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
        Set up now
      </button>
      <button type="button" onClick={close} aria-label="Dismiss"
        style={{ padding: 6, borderRadius: 6, background: 'transparent', border: 'none', color: '#92400E', cursor: 'pointer', flexShrink: 0 }}>
        <FiX size={16} />
      </button>
    </div>
  );
}