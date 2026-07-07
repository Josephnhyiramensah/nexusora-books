import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * Wraps any <table> to scroll horizontally on mobile
 * Usage: <ResponsiveTable><table>...</table></ResponsiveTable>
 */
export default function ResponsiveTable({ children, minWidth = 600 }) {
  const { isMobile } = useBreakpoint();

  return (
    <div style={{
      overflowX: isMobile ? 'auto' : 'visible',
      WebkitOverflowScrolling: 'touch',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ minWidth: isMobile ? minWidth : 'auto' }}>
        {children}
      </div>
    </div>
  );
}