import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiDollarSign, FiTrendingUp, FiTrendingDown, FiCreditCard,
  FiSend, FiFileText, FiUsers, FiShoppingBag, FiCheckSquare, FiAlertCircle,
} from 'react-icons/fi';
import dashboardService from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { formatCurrency, formatDate } from '../../utils/formatters';

function StatCard({ label, value, icon: Icon, color, subtitle, onClick }) {
  const { isMobile } = useBreakpoint();
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      padding: isMobile ? '14px 16px' : '20px 24px',
      cursor: onClick ? 'pointer' : 'default',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
          <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{value}</p>
          {subtitle && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { companyName } = useTenant();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    dashboardService.getSummary()
      .then((r) => { if (r.success) setData(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Loading dashboard...</p>;
  if (!data)   return <p style={{ padding: 40, color: 'var(--text-muted)' }}>No data available.</p>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const quickStats = [
    { label: 'Customers',     value: data.customerCount,  icon: FiUsers,       color: '#0891B2' },
    { label: 'Vendors',       value: data.vendorCount,     icon: FiShoppingBag, color: '#D97706' },
    { label: 'Invoices',      value: data.invoiceCount,    icon: FiSend,        color: '#2563EB' },
    { label: 'Bills',         value: data.billCount,       icon: FiCreditCard,  color: '#7C3AED' },
    { label: 'Draft Journals',value: data.draftJournals,   icon: FiFileText,    color: '#D97706' },
    { label: 'Pending Tasks', value: data.pendingTodos,    icon: FiCheckSquare, color: '#E11D48' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 16 : 28 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: isMobile ? 20 : 26, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {greeting}, {user?.firstName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{companyName} — Financial Dashboard</p>
      </div>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: isMobile ? 10 : 16,
        marginBottom: isMobile ? 16 : 28,
      }}>
        <StatCard label="Cash Balance"     value={formatCurrency(data.cashBalance)}    icon={FiDollarSign}  color="#16A34A" />
        <StatCard label="Total Revenue"    value={formatCurrency(data.totalRevenue)}   icon={FiTrendingUp}  color="#2563EB" />
        <StatCard label="Total Expenses"   value={formatCurrency(data.totalExpenses)}  icon={FiTrendingDown} color="#DC2626" />
        <StatCard label="Net Income"       value={formatCurrency(data.netIncome)}      icon={FiDollarSign}  color={data.netIncome >= 0 ? '#16A34A' : '#DC2626'} />
        <StatCard label="Receivables (AR)" value={formatCurrency(data.outstandingAR)} icon={FiSend}        color="#D97706"
          subtitle={`${data.overdueInvoices} overdue`} onClick={() => navigate('/invoicing/invoices')} />
        <StatCard label="Payables (AP)"    value={formatCurrency(data.outstandingAP)} icon={FiCreditCard}  color="#7C3AED"
          subtitle={`${data.overdueBills} overdue`}   onClick={() => navigate('/bills/list')} />
      </div>

      {/* Quick Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: isMobile ? 8 : 12,
        marginBottom: isMobile ? 16 : 28,
      }}>
        {quickStats.map((item, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: isMobile ? '12px 10px' : '16px 20px', textAlign: 'center' }}>
            <item.icon size={16} color={item.color} style={{ marginBottom: 6 }} />
            <p style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</p>
            <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--text-muted)' }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Two Column: Recent Journals + Unpaid Invoices */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? 12 : 20,
        marginBottom: isMobile ? 12 : 20,
      }}>
        {/* Recent Journals */}
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent Journal Entries</h3>
            <button onClick={() => navigate('/journals')} style={{ fontSize: 12, color: 'var(--tech-blue)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>View all</button>
          </div>
          {data.recentJournals.length === 0
            ? <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No entries yet</p>
            : data.recentJournals.map((j, i) => (
              <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, marginRight: 6 }}>{j.entryNumber}</span>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.description || j.journalType}</span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{formatCurrency(j.totalDebit)}</span>
                  <br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(j.date)}</span>
                </div>
              </div>
            ))
          }
        </div>

        {/* Unpaid Invoices */}
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Unpaid Invoices</h3>
            <button onClick={() => navigate('/invoicing/invoices')} style={{ fontSize: 12, color: 'var(--tech-blue)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>View all</button>
          </div>
          {data.unpaidInvoices.length === 0
            ? <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>All caught up!</p>
            : data.unpaidInvoices.map((inv, i) => {
              const isOverdue = new Date(inv.dueDate) < new Date();
              return (
                <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, marginRight: 6 }}>{inv.invoiceNumber}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{inv.customer?.name}</span>
                    {isOverdue && <FiAlertCircle size={11} color="var(--danger)" style={{ marginLeft: 4 }} />}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--warning)' }}>{formatCurrency(inv.balance)}</span>
                    <br /><span style={{ fontSize: 10, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>Due: {formatDate(inv.dueDate)}</span>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Unpaid Bills */}
      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Unpaid Bills</h3>
          <button onClick={() => navigate('/bills/list')} style={{ fontSize: 12, color: 'var(--tech-blue)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>View all</button>
        </div>
        {data.unpaidBills.length === 0
          ? <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No outstanding bills</p>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {data.unpaidBills.map((bill, i) => {
                const isOverdue = new Date(bill.dueDate) < new Date();
                return (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, marginRight: 6 }}>{bill.billNumber}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{bill.vendor?.name}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--danger)' }}>{formatCurrency(bill.balance)}</span>
                      <br /><span style={{ fontSize: 10, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>Due: {formatDate(bill.dueDate)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}