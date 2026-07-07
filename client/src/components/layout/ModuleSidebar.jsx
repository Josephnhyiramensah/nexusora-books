// client/src/components/layout/ModuleSidebar.jsx

import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiChevronLeft } from 'react-icons/fi';

/**
 * @param {Object} props
 * @param {string} props.moduleTitle - e.g. 'Journals'
 * @param {Array} props.items - [{ path, label, icon: ReactComponent }]
 */
export default function ModuleSidebar({ moduleTitle, items = [] }) {
  const navigate = useNavigate();

  return (
    <aside style={{
      width: 'var(--sidebar-width)', minHeight: '100vh',
      background: 'var(--bg-sidebar)', color: 'var(--text-on-dark)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Back to Home */}
      <button onClick={() => navigate('/home')} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '18px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
        transition: 'color var(--transition-fast)',
      }}>
        <FiChevronLeft size={16} />
        <FiHome size={16} />
        <span>Home</span>
      </button>

      {/* Module Title */}
      <div style={{
        padding: '20px 24px 12px',
        fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600,
        letterSpacing: '0.01em',
      }}>
        {moduleTitle}
      </div>

      {/* Navigation Items */}
      <nav style={{ flex: 1, padding: '4px 0' }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 24px',
                color: isActive ? 'var(--nexusora-gold)' : 'rgba(255,255,255,0.65)',
                background: isActive ? 'rgba(201, 162, 39, 0.1)' : 'transparent',
                borderRight: isActive ? '3px solid var(--nexusora-gold)' : '3px solid transparent',
                fontSize: 14, fontWeight: isActive ? 500 : 400,
                transition: 'all var(--transition-fast)', textDecoration: 'none',
              })}
            >
              {Icon && <Icon size={17} style={{ flexShrink: 0 }} />}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
        fontSize: 11, color: 'rgba(255,255,255,0.3)',
      }}>
        Nexusora Books v1.0
      </div>
    </aside>
  );
}