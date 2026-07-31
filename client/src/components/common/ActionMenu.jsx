// client/src/components/common/ActionMenu.jsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMoreVertical } from 'react-icons/fi';

export default function ActionMenu({ items = [], trigger }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const menuRef = useRef(null);

  // Flip the menu above the button when there isn't room below (bottom rows).
  const toggleOpen = () => {
    if (!isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estMenuHeight = Math.min(60 + items.length * 44, 360);
      setOpenUp(spaceBelow < estMenuHeight + 20);
    }
    setIsOpen((v) => !v);
  };

  useEffect(() => {
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const getColor = (variant, disabled) => {
    if (disabled) return '#CBD5E0';
    if (variant === 'danger') return '#DC2626';
    if (variant === 'warning') return '#D97706';
    if (variant === 'success') return '#16A34A';
    return '#1A3560';
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      {trigger ? (
        <div onClick={toggleOpen} style={{ cursor: 'pointer' }}>{trigger}</div>
      ) : (
        <motion.button
          onClick={toggleOpen}
          whileHover={{ background: '#EBF5FF', borderColor: '#2E75B6' }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid #E2E8F0', background: '#fff',
            fontSize: 13, fontWeight: 500, color: '#1A3560',
            cursor: 'pointer', transition: 'all 150ms',
          }}
        >
          Actions <FiMoreVertical size={14} />
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: openUp ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: openUp ? 6 : -6 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            style={{
              position: 'absolute',
              ...(openUp ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }),
              right: 0,
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(26,53,96,0.16)',
              minWidth: 210,
              zIndex: 9999,
              overflow: 'hidden',
            }}
          >
            {items.map((item, i) => (
              <div key={i}>
                {item.dividerBefore && i > 0 && (
                  <div style={{ height: 1, background: '#F0F4F8', margin: '4px 0' }} />
                )}
                <motion.button
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick();
                      setIsOpen(false);
                    }
                  }}
                  whileHover={!item.disabled ? { background: '#F7FAFC' } : {}}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    fontSize: 13,
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    color: getColor(item.variant, item.disabled),
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 10,
                      background: item.variant === 'danger' ? '#FEE2E2' : '#D1FAE5',
                      color: item.variant === 'danger' ? '#DC2626' : '#065F46',
                    }}>{item.badge}</span>
                  )}
                </motion.button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
