import { useState } from 'react';
import { motion } from 'framer-motion';

// Chart Sync — platform maintenance. Pushes any missing STANDARD accounts to
// EVERY tenant at once (additive only: never modifies, renames, or deletes an
// account a tenant already has). Used after new standard accounts are added to
// the seed. Calls the platform-protected POST /platform/sync-chart-all via the
// platformApi instance (platform token), passed in as a prop.
export default function ChartSyncPanel({ platformApi }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);   // [{ subdomain, ok, added, error }]
  const [summary, setSummary] = useState('');

  const run = async () => {
    if (!window.confirm('Add any missing standard accounts to ALL tenants?\n\nThis only ADDS accounts that are missing. It never changes, renames, or deletes any account a company already has, and no balances are touched.')) return;
    setRunning(true);
    setResults(null);
    setSummary('');
    try {
      const { data } = await platformApi.post('/platform/sync-chart-all');
      if (data.success) {
        setResults(Array.isArray(data.data) ? data.data : []);
        setSummary(data.message || '');
      } else {
        alert(data.message || 'Sync failed.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Sync failed.');
    } finally {
      setRunning(false);
    }
  };

  const totalAdded = results ? results.reduce((s, r) => s + (r.added || 0), 0) : 0;
  const failed = results ? results.filter((r) => !r.ok) : [];

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ padding: '12px 16px', background: '#EFF6FF', borderRadius: 10, fontSize: 13, color: '#1E40AF', marginBottom: 20 }}>
        Adds any missing <strong>standard</strong> accounts to <strong>every</strong> company at once — use this after adding new standard accounts to the seed. It is <strong>additive only</strong>: existing accounts, custom accounts, and all balances are left exactly as they are. Companies that are already up to date get nothing.
      </div>

      <motion.button whileHover={{ scale: running ? 1 : 1.02 }} whileTap={{ scale: running ? 1 : 0.97 }}
        onClick={run} disabled={running}
        style={{
          padding: '12px 28px', borderRadius: 10,
          background: running ? '#9CA3AF' : 'linear-gradient(135deg, #C9A227, #e0b930)',
          color: '#1A3560', fontSize: 14, fontWeight: 700, border: 'none',
          cursor: running ? 'not-allowed' : 'pointer',
        }}>
        {running ? '⏳ Syncing all tenants…' : '🧮 Push Standard Chart to All Tenants'}
      </motion.button>

      {summary && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: '#D1FAE5', borderRadius: 10, color: '#065F46', fontSize: 14, fontWeight: 600 }}>
          ✅ {summary} {totalAdded > 0 ? `(${totalAdded} account${totalAdded !== 1 ? 's' : ''} added in total)` : '(everything already up to date)'}
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#991B1B', fontSize: 13 }}>
          ⚠️ {failed.length} tenant(s) failed — see the list below. They can be retried safely (the sync is additive and idempotent).
        </div>
      )}

      {results && results.length > 0 && (
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>Company</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#6B7280' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.subdomain || i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#FAFBFC' : '#fff' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{r.subdomain}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    {r.ok ? (
                      <span style={{ fontWeight: 600, color: r.added > 0 ? '#065F46' : '#6B7280' }}>
                        {r.added > 0 ? `+${r.added} added` : 'up to date'}
                      </span>
                    ) : (
                      <span style={{ fontWeight: 600, color: '#991B1B' }} title={r.error || ''}>failed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}