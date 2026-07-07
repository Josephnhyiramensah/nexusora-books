import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiHome } from 'react-icons/fi';
import { useTenant } from '../../context/TenantContext';
import nexusoraLogo from '../../assets/nexusora-logo.png';

export default function MobileDrawer({ isOpen, onClose, moduleTitle, items = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyName, settings } = useTenant();

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on route change
  useEffect(() => { onClose(); }, [location.pathname]);

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 998,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 280, zIndex: 999, overflowY: 'auto',
              background: 'var(--deep-navy)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 20px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, overflow: 'hidden',
                  background: settings?.logo ? 'transparent' : 'linear-gradient(135deg, #C9A227, #e0b930)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {settings?.logo
                    ? <img src={settings.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={nexusoraLogo} alt="Nexusora" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{companyName || 'Nexusora Books'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Nexusora Books</div>
                </div>
              </div>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', flexShrink: 0,
              }}>
                <FiX size={16} />
              </button>
            </div>

            {/* Module title */}
            <div style={{ padding: '14px 20px 8px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {moduleTitle}
              </p>
            </div>

            {/* Home button */}
            <button onClick={() => handleNav('/home')} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px', color: 'rgba(255,255,255,0.6)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 14, textAlign: 'left', width: '100%',
            }}>
              <FiHome size={16} /> Home
            </button>

            {/* Nav items */}
            <div style={{ flex: 1, padding: '4px 12px' }}>
              {items.map((item, i) => {
                const isActive = location.pathname === item.path ||
                  (!item.exact && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <motion.button key={i}
                    onClick={() => handleNav(item.path)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '13px 12px', borderRadius: 10,
                      background: isActive ? 'rgba(201,162,39,0.15)' : 'transparent',
                      border: isActive ? '1px solid rgba(201,162,39,0.25)' : '1px solid transparent',
                      color: isActive ? '#C9A227' : 'rgba(255,255,255,0.65)',
                      fontSize: 14, fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer', textAlign: 'left', marginBottom: 2,
                    }}
                  >
                    {Icon && <Icon size={16} style={{ flexShrink: 0 }} />}
                    {item.label}
                    {isActive && (
                      <div style={{
                        marginLeft: 'auto', width: 6, height: 6,
                        borderRadius: '50%', background: '#C9A227',
                      }} />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                Nexusora Technologies · Prof. JNK Mensah
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}