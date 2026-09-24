// client/src/modules/settings/ChartMaintenanceTab.jsx
//
// The chart "Update / Sync" maintenance action, moved off the Chart of Accounts
// page into Settings where one-off admin maintenance belongs. This ONLY adds any
// missing STANDARD accounts to this company's chart — it never modifies, renames,
// or deletes an account the company already has (custom accounts are safe). Adding
// and editing individual accounts stays on the Accounts page as before.

import { useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';

const card = { background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 28, maxWidth: 640 };

export default function ChartMaintenanceTab() {
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const handleSync = async () => {
    if (!window.confirm("Add any missing standard accounts to this company's chart? Existing accounts and balances are not changed.")) return;
    setSyncing(true);
    setResult(null);
    try {
      const { data } = await api.post('/accounts/sync-chart');
      if (data.success) {
        setResult(data.message || 'Chart updated.');
        showToast(data.message || 'Chart updated.');
      } else {
        showToast(data.message || 'Sync failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Chart Maintenance</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.6 }}>
        Adds any missing <strong>standard</strong> accounts to this company's chart of accounts — useful after new
        standard accounts are introduced to the system. This is a one-off maintenance action.
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        It <strong>never changes, renames, or deletes</strong> an account you already have. Your own custom accounts
        and all balances are left exactly as they are. To add or edit a single account, use the Chart of Accounts page.
      </p>

      <button onClick={handleSync} disabled={syncing}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px',
          borderRadius: 'var(--radius-sm)', border: 'none',
          background: 'var(--nexusora-gold)', color: 'var(--deep-navy)',
          fontSize: 14, fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer',
        }}>
        <FiRefreshCw size={15} /> {syncing ? 'Updating…' : 'Update Chart of Accounts'}
      </button>

      {result && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#065F46' }}>
          {result}
        </div>
      )}
    </div>
  );
}