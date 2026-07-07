import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import TopBar from '../components/layout/TopBar';
import MobileDrawer from '../components/layout/MobileDrawer';
import HomeTile from '../components/home/HomeTile';
import { StaggerContainer, StaggerItem, DropDown } from '../components/common/Animate';
import { useState } from 'react';
import MobileSearchBar from '../components/layout/MobileSearchBar';
import {
  FiGrid, FiArchive, FiAlertCircle, FiShield, FiTrendingUp,
  FiSend, FiCreditCard, FiPackage, FiTruck, FiUsers,
  FiHome as FiBankIcon, FiTarget, FiPercent, FiBarChart2,
  FiEdit3, FiCheckSquare, FiSettings, FiDollarSign,
  FiMinusCircle, FiBookOpen, FiZap, FiActivity,
} from 'react-icons/fi';

const moduleTiles = [
  { label: 'Dashboard',           subtitle: 'Financial overview',            path: '/dashboard',            accentColor: '#1A3560', icon: FiGrid },
  { label: 'Assets',              subtitle: 'Cash, bank, receivables',       path: '/assets',               accentColor: '#0D9488', icon: FiArchive },
  { label: 'Liabilities',         subtitle: 'Payables, loans, accruals',     path: '/liabilities',          accentColor: '#DC2626', icon: FiAlertCircle },
  { label: 'Equity',              subtitle: 'Capital, retained earnings',     path: '/equity',               accentColor: '#7C3AED', icon: FiShield },
  { label: 'Revenue',             subtitle: 'Sales, service income',          path: '/revenue',              accentColor: '#16A34A', icon: FiTrendingUp },
  { label: 'Expenses',            subtitle: 'Operating costs, COGS',          path: '/expenses',             accentColor: '#EA580C', icon: FiMinusCircle },
  { label: 'Journals',            subtitle: 'General, sales, purchases',      path: '/journals',             accentColor: '#2563EB', icon: FiBookOpen },
  { label: 'Invoicing',           subtitle: 'Customer invoices & receipts',   path: '/invoicing',            accentColor: '#0891B2', icon: FiSend },
  { label: 'Bills & Payments',    subtitle: 'Vendor bills & payments',        path: '/bills',                accentColor: '#D97706', icon: FiCreditCard },
  { label: 'Inventory',           subtitle: 'Stock tracking & valuation',     path: '/inventory',            accentColor: '#4F46E5', icon: FiPackage },
  { label: 'Fixed Assets',        subtitle: 'Asset register & depreciation',  path: '/fixed-assets',         accentColor: '#475569', icon: FiTruck },
  { label: 'Payroll',             subtitle: 'Salaries, PAYE, SSNIT',          path: '/payroll',              accentColor: '#DB2777', icon: FiUsers },
  { label: 'Banking',             subtitle: 'Bank accounts',                  path: '/banking',              accentColor: '#0284C7', icon: FiBankIcon },
  { label: 'Budget',              subtitle: 'Budget vs actual & variance',    path: '/budget',               accentColor: '#65A30D', icon: FiTarget },
  { label: 'Tax',                 subtitle: 'VAT, PAYE, corporate tax',       path: '/tax',                  accentColor: '#78716C', icon: FiPercent },
  { label: 'Reports',             subtitle: 'Financial statements & exports', path: '/reports',              accentColor: '#8B5CF6', icon: FiBarChart2 },
  { label: 'Notes',               subtitle: 'Personal, company, announcements', path: '/notes',              accentColor: '#CA8A04', icon: FiEdit3 },
  { label: 'To-Do',               subtitle: 'Tasks, assignments, checklists', path: '/todos',               accentColor: '#E11D48', icon: FiCheckSquare },
  { label: 'AI Assistant',        subtitle: 'Anomaly detection & forecasting', path: '/ai',                  accentColor: '#C9A227', icon: FiZap },
  { label: 'Audit Log',           subtitle: 'Security & activity trail', path: '/audit', accentColor: '#1A3560', icon: FiActivity },
  { label: 'Settings',            subtitle: 'Users, roles, company profile',  path: '/settings',             accentColor: '#6B7280', icon: FiSettings },
  { label: 'Analytics', subtitle: 'Charts, ratios & financial insights', path: '/assets/analytics', accentColor: '#C9A227', icon: FiBarChart2 },
];

function HeroStatCard({ label, value, gradient, icon: Icon }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      style={{
        background: gradient,
        borderRadius: 14,
        padding: '20px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}
    >
      <div>
        <p style={{ fontSize: 11, opacity: 0.75, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{value}</p>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} />
      </div>
    </motion.div>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { companyName } = useTenant();
  const { isMobile, isTablet, width } = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const showMobileNav = isMobile || isTablet;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: isMobile ? 'short' : 'long',
    year: 'numeric', month: isMobile ? 'short' : 'long', day: 'numeric',
  });

  const heroCards = [
    { label: 'Total Revenue',    value: 'GHS 0.00', gradient: 'linear-gradient(135deg, #1A3560, #2E75B6)', icon: FiTrendingUp },
    { label: 'Total Expenses',   value: 'GHS 0.00', gradient: 'linear-gradient(135deg, #DC2626, #ef4444)', icon: FiMinusCircle },
    { label: 'Cash Balance',     value: 'GHS 0.00', gradient: 'linear-gradient(135deg, #16A34A, #22c55e)', icon: FiDollarSign },
    { label: 'Receivables',      value: 'GHS 0.00', gradient: 'linear-gradient(135deg, #D97706, #f59e0b)', icon: FiSend },
    { label: 'Payables',         value: 'GHS 0.00', gradient: 'linear-gradient(135deg, #7C3AED, #a78bfa)', icon: FiCreditCard },
  ];

  // Responsive tile columns
  const tileColumns = isMobile
    ? 'repeat(2, 1fr)'
    : isTablet
      ? 'repeat(3, 1fr)'
      : 'repeat(auto-fill, minmax(170px, 1fr))';

  // Responsive hero columns
  const heroColumns = isMobile
    ? 'repeat(2, 1fr)'
    : isTablet
      ? 'repeat(3, 1fr)'
      : 'repeat(5, 1fr)';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      style={{ minHeight: '100vh', background: 'var(--bg-app)' }}
    >
      {/* Mobile drawer */}
      {showMobileNav && (
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          moduleTitle="Home"
          items={moduleTiles.map((t) => ({ path: t.path, label: t.label, icon: t.icon }))}
        />
      )}

      <DropDown>
        <TopBar onMenuToggle={showMobileNav ? () => setDrawerOpen(true) : undefined} />
      </DropDown>

{/* Mobile search — below topbar */}
      {isMobile && (
        <div style={{
          padding: '8px 12px',
          background: '#fff',
          borderBottom: '1px solid var(--border)',
        }}>
          <MobileSearchBar />
        </div>
      )}

      <div style={{
        maxWidth: 1280, margin: '0 auto',
        padding: isMobile ? '16px 12px 48px' : isTablet ? '20px 20px 48px' : '28px 32px 48px',
      }}>
        {/* Greeting */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{ marginBottom: isMobile ? 16 : 24 }}
        >
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: isMobile ? 20 : 26,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            {greeting}, {user?.firstName} 👋
          </h1>
          <p style={{ fontSize: isMobile ? 12 : 14, color: 'var(--text-secondary)' }}>{today}</p>
        </motion.div>

        {/* Hero stat cards */}
        <StaggerContainer
          staggerDelay={0.06}
          style={{
            display: 'grid',
            gridTemplateColumns: heroColumns,
            gap: isMobile ? 10 : 16,
            marginBottom: isMobile ? 20 : 32,
          }}
        >
          {heroCards.map((card, i) => (
            <StaggerItem key={i}>
              <HeroStatCard {...card} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Section label */}
        <p style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: isMobile ? 10 : 16,
        }}>
          Modules
        </p>

        {/* Module tiles */}
        <StaggerContainer
          staggerDelay={0.04}
          style={{
            display: 'grid',
            gridTemplateColumns: tileColumns,
            gap: isMobile ? 10 : 16,
          }}
        >
          {moduleTiles.map((tile) => (
            <StaggerItem key={tile.path}>
              <HomeTile {...tile} compact={isMobile} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </motion.div>
  );
}