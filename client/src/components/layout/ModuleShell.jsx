import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiLock } from 'react-icons/fi';
import TopBar from './TopBar';
import ModuleSidebar from './ModuleSidebar';
import MobileDrawer from './MobileDrawer';
import { useTenant } from '../../context/TenantContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import api from '../../services/api';

export default function ModuleShell({ moduleTitle, sidebarItems }) {
  const { subdomain } = useTenant();
  const { isMobile, isTablet } = useBreakpoint();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [daysLeft, setDaysLeft] = useState(null);

  // Expired-subscription state → drives the read-only paywall overlay.
  const [expired, setExpired] = useState(false);
  const [expiryDate, setExpiryDate] = useState(null);
  const [expiredPlan, setExpiredPlan] = useState('');
  const [paywallDismissed, setPaywallDismissed] = useState(false);

  const showMobileNav = isMobile || isTablet;

  useEffect(() => {
    if (!subdomain) return;
    const checkSub = async () => {
      try {
        const { data } = await api.get(`/payment/status/${subdomain}`);
        if (data.success) {
          setDaysLeft(data.data.daysLeft);
          setExpired(!!data.data.isExpired);
          setExpiryDate(data.data.expiryDate || null);
          setExpiredPlan(data.data.plan || '');
        }
      } catch {}
    };
    checkSub();
  }, [subdomain]);

  const fmtDate = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return ''; }
  };

  const planLabel = expiredPlan ? expiredPlan.charAt(0).toUpperCase() + expiredPlan.slice(1) : 'subscription';
  const showPaywall = expired && !paywallDismissed;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {!showMobileNav && (
        <button onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          style={{ position: 'fixed', top: 16, left: sidebarCollapsed ? 12 : 'calc(var(--sidebar-width) - 16px)', zIndex: 200, width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', color: 'var(--deep-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', transition: 'left 0.25s ease' }}>
          {sidebarCollapsed ? <FiChevronRight size={17} /> : <FiChevronLeft size={17} />}
        </button>
      )}

      {/* Desktop Sidebar — hidden on mobile/tablet */}
      {!showMobileNav && !sidebarCollapsed && (
        <motion.div
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <ModuleSidebar moduleTitle={moduleTitle} items={sidebarItems} />
        </motion.div>
      )}

      {/* Mobile Drawer */}
      {showMobileNav && (
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          moduleTitle={moduleTitle}
          items={sidebarItems}
        />
      )}

      {/* Main content area */}
      <div style={{
        flex: 1,
        marginLeft: (showMobileNav || sidebarCollapsed) ? 0 : 'var(--sidebar-width)',
        transition: 'margin-left 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        minWidth: 0, // prevent overflow
      }}>
        {/* Header */}
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <TopBar onMenuToggle={showMobileNav ? () => setDrawerOpen(true) : undefined} />
        </motion.div>

        {/* Mobile search bar — below topbar */}
        {isMobile && (
          <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)',
              padding: '8px 14px', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 16 }}>🔍</span>
              <input
                type="text"
                placeholder="Search..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, width: '100%' }}
                onFocus={() => {
                  document.querySelector('input[placeholder="Search..."]')?.blur();
                }}
              />
            </div>
          </div>
        )}

        {/* Expired — persistent read-only banner (shows after the overlay is dismissed) */}
        {expired && paywallDismissed && (
          <div style={{
            background: '#DC2626', color: '#fff',
            padding: isMobile ? '9px 16px' : '9px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 8, fontSize: 13, fontWeight: 500,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FiLock size={14} /> Read-only — your {planLabel} plan expired{expiryDate ? ` on ${fmtDate(expiryDate)}` : ''}. Renew to make changes.
            </span>
            <button onClick={() => navigate('/upgrade')}
              style={{ padding: '5px 14px', background: '#fff', color: '#DC2626', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              Renew →
            </button>
          </div>
        )}

        {/* Trial expiry warning — only when NOT already expired */}
        {!expired && daysLeft !== null && daysLeft <= 5 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              background: daysLeft <= 1 ? '#DC2626' : '#D97706',
              color: '#fff',
              padding: isMobile ? '10px 16px' : '10px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: isMobile ? 12 : 13 }}>
              ⏰ {daysLeft === 0 ? 'Trial expired.' : `Trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}
              {!isMobile && ' Upgrade now to keep access.'}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/upgrade')}
              style={{
                padding: '5px 14px', background: '#fff', color: '#1A3560',
                borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Upgrade →
            </motion.button>
          </motion.div>
        )}

        {/* Page content */}
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          style={{
            flex: 1,
            padding: isMobile ? '16px' : '32px',
            background: 'var(--bg-app)',
            minWidth: 0,
          }}
        >
          <Outlet />
        </motion.main>
      </div>

      {/* ── Expired paywall overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(15, 34, 64, 0.72)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 200 }}
              style={{
                background: '#fff', borderRadius: 20, padding: isMobile ? '32px 24px' : '44px 40px',
                maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
                background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiLock size={28} color="#DC2626" />
              </div>

              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 10 }}>
                Your {planLabel} plan has expired
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>
                {expiryDate
                  ? `Your subscription expired on ${fmtDate(expiryDate)}.`
                  : 'Your subscription has expired.'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
                You can still view your data, but you'll need to renew before you can create or edit anything.
              </p>

              <button
                onClick={() => navigate('/upgrade')}
                style={{
                  width: '100%', padding: '13px 24px', borderRadius: 12, marginBottom: 12,
                  background: 'linear-gradient(135deg, #1A3560, #2E75B6)', color: '#fff',
                  fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                }}
              >
                Renew Subscription
              </button>
              <button
                onClick={() => setPaywallDismissed(true)}
                style={{
                  width: '100%', padding: '11px 24px', borderRadius: 12,
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                Continue in read-only mode
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}