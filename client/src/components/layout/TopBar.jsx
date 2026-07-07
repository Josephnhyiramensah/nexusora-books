import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronDown, FiUser, FiLogOut, FiSettings, FiMenu } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import nexusoraLogo from '../../assets/nexusora-logo.png';

export default function TopBar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const { companyName, subdomain, settings } = useTenant();
  const { isMobile, isTablet } = useBreakpoint();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';
  const shortName = user ? `${user.firstName?.[0]}${user.lastName?.[0]}` : 'U';
  const displayCompany = (settings?.whiteLabel?.enabled && settings?.whiteLabel?.brandName)
  ? settings.whiteLabel.brandName
  : (companyName || 'Nexusora Books');

  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0 16px' : '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      gap: 12,
    }}>

      {/* Left: Hamburger (mobile) + Logo + Company */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, flexShrink: 0 }}>
        {/* Hamburger — mobile/tablet only */}
        {(isMobile || isTablet) && onMenuToggle && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onMenuToggle}
            style={{
              width: 38, height: 38, borderRadius: 8,
              background: 'var(--bg-app)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <FiMenu size={18} />
          </motion.button>
        )}

        {/* Logo */}
        {/* Logo */}
        <div style={{
          width: isMobile ? 30 : 34,
          height: isMobile ? 30 : 34,
          borderRadius: 8,
          overflow: 'hidden',
          flexShrink: 0,
          background: settings?.logo
            ? 'transparent'
            : 'linear-gradient(135deg, var(--nexusora-gold), #e0b930)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontWeight: 700,
          fontSize: 15, color: 'var(--deep-navy)',
          border: settings?.logo ? '1px solid var(--border)' : 'none',
        }}>
          {settings?.logo
            ? <img src={settings.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (companyName?.[0]?.toUpperCase() || 'N')
          }
        </div>

        {/* Company name — hidden on small mobile */}
        {!isMobile && (
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {displayCompany}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Nexusora Books</div>
          </div>
        )}
      </div>

      {/* Centre: Global Search — hidden on small mobile */}
      {!isMobile && <GlobalSearch />}

      {/* Right: Notifications + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexShrink: 0 }}>
        <NotificationBell />

        <div ref={menuRef} style={{ position: 'relative' }}>
          <motion.button
            onClick={() => setMenuOpen(!menuOpen)}
            whileTap={{ scale: 0.96 }}
            style={{
              display: 'flex', alignItems: 'center',
              gap: isMobile ? 0 : 8,
              padding: isMobile ? '4px' : '6px 10px',
              borderRadius: 'var(--radius-md)',
              background: menuOpen ? 'var(--bg-app)' : 'transparent',
              border: 'none', cursor: 'pointer',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--tech-blue)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {shortName}
            </div>
            {!isMobile && (
              <>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {user?.role?.replace('_', ' ')}
                  </div>
                </div>
                <FiChevronDown size={14} style={{
                  color: 'var(--text-muted)',
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 200ms',
                }} />
              </>
            )}
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -6 }}
                transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  background: '#fff', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                  minWidth: 200, padding: '6px 0', zIndex: 200,
                }}
              >
                {/* Mobile: show name at top */}
                {isMobile && (
                  <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
                  </div>
                )}
                <button onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', fontSize: 14, color: 'var(--text-primary)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <FiUser size={16} /> Profile
                </button>
                <button onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', fontSize: 14, color: 'var(--text-primary)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <FiSettings size={16} /> Settings
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', fontSize: 14, color: 'var(--danger)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <FiLogOut size={16} /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}