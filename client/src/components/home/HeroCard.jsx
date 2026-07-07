// client/src/components/home/HeroCard.jsx

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.value - formatted number e.g. 'GHS 125,000.00'
 * @param {string} props.gradient - CSS gradient string
 * @param {React.Component} props.icon
 */
export default function HeroCard({ label, value, gradient, icon: Icon }) {
  return (
    <div style={{
      background: gradient,
      borderRadius: 'var(--radius-lg)', padding: '24px 28px',
      color: '#FFFFFF', position: 'relative', overflow: 'hidden',
      minWidth: 0,
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 6, fontWeight: 500 }}>{label}</p>
          <p style={{
            fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-heading)',
            letterSpacing: '-0.02em',
          }}>{value}</p>
        </div>
        {Icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={20} color="#fff" />
          </div>
        )}
      </div>
    </div>
  );
}