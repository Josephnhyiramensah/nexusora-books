// client/src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './styles/global.css';

// ── Error tracking (Sentry) ─────────────────────────────────────────────────
// Only initialises when a DSN is provided (VITE_SENTRY_DSN in client/.env).
// Without a DSN it's a no-op, so local dev without Sentry configured is fine.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'production',
    // Capture a small sample of performance traces. Tune later if needed.
    tracesSampleRate: 0.1,
    // Don't send default PII (IP, etc.). Financial app — keep it lean.
    sendDefaultPii: false,
  });
}

// Friendly fallback shown if the app crashes, instead of a blank white page.
function CrashFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', color: '#1A3560',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
      <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 420, marginBottom: 20 }}>
        The page hit an unexpected error. Refreshing usually fixes it. If it keeps
        happening, please let us know.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '11px 26px', borderRadius: 8, background: '#C9A227',
          color: '#1A3560', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
        }}
      >
        Refresh the page
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
