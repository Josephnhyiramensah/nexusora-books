import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), duration);
  }, []);

  const icons = { success: FiCheck, error: FiAlertCircle, warning: FiInfo };
  const colors = {
    success: { bg: '#065F46', border: '#16A34A' },
    error: { bg: '#991B1B', border: '#DC2626' },
    warning: { bg: '#92400E', border: '#D97706' },
  };

  const ToastComponent = (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
      <AnimatePresence>
        {toast && (() => {
          const Icon = icons[toast.type] || FiCheck;
          const color = colors[toast.type] || colors.success;
          return (
            <motion.div
              key={toast.id}
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 22px', borderRadius: 'var(--radius-md)',
                background: color.bg, color: '#fff', fontSize: 14, fontWeight: 500,
                boxShadow: '0 12px 32px rgba(0,0,0,0.25)', maxWidth: 420,
                borderLeft: `4px solid ${color.border}`,
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button onClick={() => setToast(null)} style={{ color: 'rgba(255,255,255,0.6)', padding: 2, flexShrink: 0 }}>
                <FiX size={16} />
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );

  return { showToast, ToastComponent };
}