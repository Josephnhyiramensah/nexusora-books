import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export default function HomeTile({ label, subtitle, path, accentColor, icon: Icon, compact }) {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const isCompact = compact || isMobile;

  return (
    <motion.button
      onClick={() => navigate(path)}
      whileHover={{ scale: 1.04, boxShadow: '0 8px 24px rgba(26,53,96,0.14)' }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isCompact ? 8 : 10,
        padding: isCompact ? '18px 12px' : '28px 16px',
        background: '#fff',
        borderRadius: isCompact ? 12 : 'var(--radius-tile)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        minHeight: isCompact ? 110 : 150,
        width: '100%',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: isCompact ? 3 : 4,
        background: accentColor,
      }} />

      {/* Icon */}
      <motion.div
        whileHover={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.4 }}
        style={{
          width: isCompact ? 38 : 48,
          height: isCompact ? 38 : 48,
          borderRadius: isCompact ? 10 : 12,
          background: `${accentColor}14`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Icon && <Icon size={isCompact ? 18 : 22} color={accentColor} />}
      </motion.div>

      {/* Label */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{
          fontSize: isCompact ? 11 : 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: isCompact ? 0 : 2,
          lineHeight: 1.3,
        }}>
          {label}
        </div>
        {!isCompact && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            {subtitle}
          </div>
        )}
      </div>
    </motion.button>
  );
}