import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  const [daysLeft, setDaysLeft] = useState(null);

  const showMobileNav = isMobile || isTablet;

  useEffect(() => {
    if (!subdomain) return;
    const checkSub = async () => {
      try {
        const { data } = await api.get(`/payment/status/${subdomain}`);
        if (data.success) setDaysLeft(data.data.daysLeft);
      } catch {}
    };
    checkSub();
  }, [subdomain]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Desktop Sidebar — hidden on mobile/tablet */}
      {!showMobileNav && (
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
        marginLeft: showMobileNav ? 0 : 'var(--sidebar-width)',
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
                  // On mobile, navigate to a search-focused state
                  document.querySelector('input[placeholder="Search..."]')?.blur();
                }}
              />
            </div>
          </div>
        )}

        {/* Trial expiry warning */}
        {daysLeft !== null && daysLeft <= 5 && (
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
    </div>
  );
}