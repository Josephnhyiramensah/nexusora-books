import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export default function Modal({ isOpen, onClose, title, children, width = 560 }) {
  const { isMobile } = useBreakpoint();

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isMobile ? 0 : 24,
        }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Modal panel */}
          <motion.div
            initial={isMobile
              ? { y: '100%' }
              : { opacity: 0, scale: 0.88, y: 20 }
            }
            animate={isMobile
              ? { y: 0 }
              : { opacity: 1, scale: 1, y: 0 }
            }
            exit={isMobile
              ? { y: '100%' }
              : { opacity: 0, scale: 0.88, y: 20 }
            }
            transition={isMobile
              ? { type: 'spring', damping: 30, stiffness: 300 }
              : { type: 'spring', damping: 22, stiffness: 280 }
            }
            style={{
              position: 'relative',
              width: isMobile ? '100%' : '100%',
              maxWidth: isMobile ? '100%' : width,
              background: '#fff',
              borderRadius: isMobile ? '20px 20px 0 0' : 16,
              boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
              maxHeight: isMobile ? '92vh' : '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drag handle (mobile) */}
            {isMobile && (
              <div style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
              </div>
            )}

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: isMobile ? '12px 20px 14px' : '18px 28px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <h3 style={{
                fontFamily: 'var(--font-heading)', fontSize: isMobile ? 16 : 17,
                fontWeight: 700, color: 'var(--text-primary)', margin: 0,
              }}>
                {title}
              </h3>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-app)', color: 'var(--text-muted)',
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <FiX size={16} />
              </motion.button>
            </div>

            {/* Content */}
            <div style={{
              padding: isMobile ? '20px 20px 24px' : '24px 28px',
              overflowY: 'auto',
              flex: 1,
              WebkitOverflowScrolling: 'touch',
            }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}