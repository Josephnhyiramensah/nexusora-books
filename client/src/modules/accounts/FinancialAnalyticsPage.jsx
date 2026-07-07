import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Sector,
} from 'recharts';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { formatCurrency } from '../../utils/formatters';
import api from '../../services/api';

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  asset:     '#0D9488',
  liability: '#DC2626',
  equity:    '#7C3AED',
  revenue:   '#16A34A',
  expense:   '#EA580C',
  cogs:      '#D97706',
  navy:      '#1A3560',
  gold:      '#C9A227',
};

const PIE_COLORS = ['#0D9488', '#DC2626', '#7C3AED', '#16A34A', '#EA580C', '#D97706', '#0284C7', '#DB2777'];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      {label && <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ fontSize: 13, color: entry.color, fontWeight: 600, margin: '2px 0' }}>
          {entry.name}: {formatCurrency(Math.abs(entry.value))}
        </p>
      ))}
    </div>
  );
}

// ─── Active Pie Shape ─────────────────────────────────────────────────────────
function ActiveShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#1A3560" style={{ fontSize: 13, fontWeight: 700 }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#6B7280" style={{ fontSize: 12 }}>
        {formatCurrency(value)}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, change, changeLabel, color, icon: Icon, trend }) {
  const { isMobile } = useBreakpoint();
  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(26,53,96,0.12)' }}
      style={{
        background: '#fff', borderRadius: 14, padding: isMobile ? '16px' : '20px 24px',
        border: '1px solid #E2E8F0', borderLeft: `4px solid ${color}`,
        transition: 'box-shadow 200ms',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>
            {label}
          </p>
          <p style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, color: '#1A3560', fontFamily: 'var(--font-heading)', marginBottom: 6 }}>
            {formatCurrency(value)}
          </p>
          {change !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {trend === 'up' ? <FiTrendingUp size={13} color={isPositive ? '#16A34A' : '#DC2626'} />
                              : <FiTrendingDown size={13} color={isPositive ? '#DC2626' : '#16A34A'} />}
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{changeLabel}</span>
            </div>
          )}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ type, title, message }) {
  const config = {
    success: { color: '#16A34A', bg: '#F0FDF4', border: '#A7F3D0', icon: FiCheckCircle },
    warning: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: FiAlertCircle },
    danger:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: FiAlertCircle },
    info:    { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: FiInfo },
  };
  const c = config[type] || config.info;
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 16px', borderRadius: 10,
        background: c.bg, border: `1px solid ${c.border}`, marginBottom: 10,
      }}
    >
      <Icon size={16} color={c.color} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3560', marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{message}</p>
      </div>
    </motion.div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function ChartSection({ title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
        padding: '20px 24px', marginBottom: 24,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A3560', marginBottom: 2 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: '#9CA3AF' }}>{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FinancialAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activePieIndex, setActivePieIndex] = useState(0);
  const { isMobile } = useBreakpoint();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch accounts, journals, invoices, bills in parallel
      const [accountsRes, journalsRes, invoicesRes, billsRes] = await Promise.all([
        api.get('/accounts?isActive=true'),
        api.get('/journals?status=posted'),
        api.get('/invoices'),
        api.get('/bills'),
      ]);

      const accounts = accountsRes.data.success ? accountsRes.data.data : [];
      const journals = journalsRes.data.success ? journalsRes.data.data : [];
      const invoices = invoicesRes.data.success ? invoicesRes.data.data : [];
      const bills    = billsRes.data.success    ? billsRes.data.data    : [];

      // ── Totals by account type ──────────────────────────────────────────
      const byType = {};
      accounts.forEach((a) => {
        if (!byType[a.type]) byType[a.type] = 0;
        byType[a.type] += Math.abs(a.balance || 0);
      });

      const totalRevenue  = byType.revenue   || 0;
      const totalExpenses = (byType.expense   || 0) + (byType.cogs || 0);
      const totalAssets   = byType.asset      || 0;
      const totalLiability= byType.liability  || 0;
      const totalEquity   = byType.equity     || 0;
      const netIncome     = totalRevenue - totalExpenses;
      const cashAccounts  = accounts.filter((a) => ['1000','1010','1020'].includes(a.code));
      const cashBalance   = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0);

      // ── Pie data ────────────────────────────────────────────────────────
      const pieData = Object.entries(byType)
        .filter(([, v]) => v > 0)
        .map(([type, value]) => ({
          name: type.charAt(0).toUpperCase() + type.slice(1),
          value: Math.round(value * 100) / 100,
          color: COLORS[type] || '#6B7280',
        }));

      // ── Bar data: Revenue vs Expenses vs Net ────────────────────────────
      const profitData = [
        { name: 'Revenue',  value: Math.round(totalRevenue * 100) / 100,   fill: COLORS.revenue },
        { name: 'Expenses', value: Math.round(totalExpenses * 100) / 100,  fill: COLORS.expense },
        { name: 'Net Income', value: Math.round(netIncome * 100) / 100,    fill: netIncome >= 0 ? COLORS.asset : COLORS.liability },
      ];

      // ── Balance Sheet bar ───────────────────────────────────────────────
      const balanceData = [
        { name: 'Assets',      value: Math.round(totalAssets * 100) / 100,    fill: COLORS.asset },
        { name: 'Liabilities', value: Math.round(totalLiability * 100) / 100, fill: COLORS.liability },
        { name: 'Equity',      value: Math.round(totalEquity * 100) / 100,    fill: COLORS.equity },
      ];

      // ── Monthly cash flow (last 6 months from journals) ─────────────────
      const cashAccountIds = cashAccounts.map((a) => a._id.toString());
      const monthlyMap = {};
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        monthlyMap[key] = { name: key, inflows: 0, outflows: 0, net: 0 };
      }

      journals.forEach((entry) => {
        const entryDate = new Date(entry.date);
        const monthKey = entryDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        if (!monthlyMap[monthKey]) return;
        (entry.lines || []).forEach((line) => {
          if (cashAccountIds.includes(line.account?.toString())) {
            monthlyMap[monthKey].inflows  += line.debit  || 0;
            monthlyMap[monthKey].outflows += line.credit || 0;
          }
        });
      });

      const cashFlowData = Object.values(monthlyMap).map((m) => ({
        ...m,
        inflows:  Math.round(m.inflows * 100) / 100,
        outflows: Math.round(m.outflows * 100) / 100,
        net:      Math.round((m.inflows - m.outflows) * 100) / 100,
      }));

      // ── Account type distribution for accounts ──────────────────────────
      const accountsByType = {};
      accounts.forEach((a) => {
        if (!accountsByType[a.type]) accountsByType[a.type] = [];
        accountsByType[a.type].push(a);
      });

      // ── Top accounts by balance ─────────────────────────────────────────
      const topAccounts = [...accounts]
        .filter((a) => Math.abs(a.balance || 0) > 0)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, 8)
        .map((a) => ({
          name: a.code + ' ' + a.name.substring(0, 20),
          balance: Math.round(Math.abs(a.balance) * 100) / 100,
          type: a.type,
          fill: COLORS[a.type] || '#6B7280',
        }));

      // ── Invoice status breakdown ────────────────────────────────────────
      const invoiceStatusMap = {};
      invoices.forEach((inv) => {
        invoiceStatusMap[inv.status] = (invoiceStatusMap[inv.status] || 0) + 1;
      });
      const invoiceStatusData = Object.entries(invoiceStatusMap).map(([status, count], i) => ({
        name: status.replace('_', ' '),
        value: count,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }));

      // ── AI-style Insights ───────────────────────────────────────────────
      const insights = [];

      const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : 0;
      const debtRatio = totalAssets > 0 ? ((totalLiability / totalAssets) * 100).toFixed(1) : 0;
      const arBalance  = accounts.find((a) => a.code === '1100')?.balance || 0;
      const apBalance  = accounts.find((a) => a.code === '2000')?.balance || 0;
      const overdueInv = invoices.filter((inv) => inv.status === 'overdue').length;
      const draftJnl   = journals.filter?.length || 0;

      if (netIncome > 0) {
        insights.push({ type: 'success', title: `Profitable — ${profitMargin}% margin`, message: `You are earning GHS ${formatCurrency(netIncome)} more than you spend. Profit margin is ${profitMargin}%. Industry benchmark for SMEs is 10-20%.` });
      } else if (netIncome < 0) {
        insights.push({ type: 'danger', title: 'Operating at a loss', message: `Expenses exceed revenue by ${formatCurrency(Math.abs(netIncome))}. Review your expense accounts and identify areas to cut.` });
      }

      if (Number(debtRatio) > 60) {
        insights.push({ type: 'warning', title: `High debt ratio — ${debtRatio}%`, message: `Your liabilities are ${debtRatio}% of your total assets. A healthy ratio is under 50%. Consider paying down debt or increasing equity.` });
      } else if (Number(debtRatio) > 0) {
        insights.push({ type: 'success', title: `Healthy debt ratio — ${debtRatio}%`, message: `Your debt-to-asset ratio is well within safe limits. You have a strong balance sheet foundation.` });
      }

      if (arBalance > totalRevenue * 0.3) {
        insights.push({ type: 'warning', title: 'High receivables outstanding', message: `GHS ${formatCurrency(arBalance)} is tied up in accounts receivable — over 30% of your revenue. Follow up on outstanding invoices to improve cash flow.` });
      }

      if (cashBalance < apBalance) {
        insights.push({ type: 'danger', title: 'Cash may not cover payables', message: `Your cash balance (${formatCurrency(cashBalance)}) is less than your payables (${formatCurrency(apBalance)}). Review upcoming payment obligations.` });
      }

      if (overdueInv > 0) {
        insights.push({ type: 'warning', title: `${overdueInv} overdue invoice${overdueInv > 1 ? 's' : ''}`, message: `You have ${overdueInv} customer invoice${overdueInv > 1 ? 's' : ''} past due date. Follow up immediately to collect payment.` });
      }

      if (insights.length === 0) {
        insights.push({ type: 'info', title: 'Record more transactions for insights', message: 'Post some journal entries and invoices to see AI-powered financial insights and recommendations here.' });
      }

      setData({
        totalRevenue, totalExpenses, totalAssets, totalLiability,
        totalEquity, netIncome, cashBalance, arBalance, apBalance,
        profitMargin, debtRatio,
        pieData, profitData, balanceData, cashFlowData,
        topAccounts, invoiceStatusData, insights,
        accountCount: accounts.length,
        transactionCount: journals.length,
      });
    } catch (err) {
      console.error('[Analytics] Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#C9A227', borderRadius: '50%', margin: '0 auto 16px' }}
          />
          <p style={{ fontSize: 14, color: '#9CA3AF' }}>Analysing your finances...</p>
        </div>
      </div>
    );
  }

  if (!data) return <p style={{ padding: 40, color: '#9CA3AF' }}>No financial data available.</p>;

  const chartHeight = isMobile ? 220 : 300;

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#1A3560', marginBottom: 4 }}>
          Financial Analytics
        </h1>
        <p style={{ fontSize: 13, color: '#9CA3AF' }}>
          {data.accountCount} accounts · {data.transactionCount} posted transactions · Live data
        </p>
      </motion.div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: isMobile ? 10 : 16,
        marginBottom: 24,
      }}>
        <KPICard label="Total Revenue"   value={data.totalRevenue}   color={COLORS.revenue}   icon={FiTrendingUp}   changeLabel="from posted entries" />
        <KPICard label="Total Expenses"  value={data.totalExpenses}  color={COLORS.expense}   icon={FiTrendingDown} changeLabel="including COGS" />
        <KPICard label="Net Income"      value={data.netIncome}      color={data.netIncome >= 0 ? COLORS.revenue : COLORS.liability} icon={FiDollarSign} changeLabel={data.netIncome >= 0 ? 'Profitable' : 'Loss'} />
        <KPICard label="Cash Balance"    value={data.cashBalance}    color={COLORS.asset}     icon={FiDollarSign}   changeLabel="cash & bank accounts" />
        <KPICard label="Total Assets"    value={data.totalAssets}    color={COLORS.asset}     icon={FiCheckCircle}  changeLabel="all asset accounts" />
        <KPICard label="Total Liabilities" value={data.totalLiability} color={COLORS.liability} icon={FiAlertCircle} changeLabel={`${data.debtRatio}% of assets`} />
      </div>

      {/* Row 1: Profit & Loss Bar + Account Distribution Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>

        <ChartSection title="Profit & Loss Overview" subtitle="Revenue, expenses, and net income comparison">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data.profitData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₵${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
                {data.profitData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Account Type Distribution" subtitle="Click a segment to explore">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data.pieData}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 55 : 70}
                outerRadius={isMobile ? 90 : 110}
                dataKey="value"
                activeIndex={activePieIndex}
                activeShape={ActiveShape}
                onMouseEnter={(_, index) => setActivePieIndex(index)}
              >
                {data.pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle" iconSize={10}
                formatter={(value) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Row 2: Cash Flow Area Chart */}
      <ChartSection
        title="Cash Flow — Last 6 Months"
        subtitle="Monthly cash inflows vs outflows and net position"
      >
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 280}>
          <AreaChart data={data.cashFlowData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#DC2626" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1A3560" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#1A3560" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₵${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: '#6B7280' }}>{v}</span>} />
            <Area type="monotone" dataKey="inflows"  name="Cash In"  stroke="#16A34A" strokeWidth={2} fill="url(#inflowGrad)" />
            <Area type="monotone" dataKey="outflows" name="Cash Out" stroke="#DC2626" strokeWidth={2} fill="url(#outflowGrad)" />
            <Area type="monotone" dataKey="net"      name="Net Flow" stroke="#1A3560" strokeWidth={2.5} fill="url(#netGrad)" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Row 3: Balance Sheet Bar + Invoice Status Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>

        <ChartSection title="Balance Sheet" subtitle="Assets = Liabilities + Equity">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data.balanceData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₵${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Balance" radius={[0, 8, 8, 0]} barSize={32}>
                {data.balanceData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Invoice Status Breakdown" subtitle="Distribution of all invoices by status">
          {data.invoiceStatusData.length === 0 ? (
            <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: 13 }}>No invoices recorded yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie data={data.invoiceStatusData} cx="50%" cy="50%" outerRadius={isMobile ? 80 : 100}
                  dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {data.invoiceStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} invoices`, '']} />
                <Legend iconType="circle" iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: '#6B7280', textTransform: 'capitalize' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>
      </div>

      {/* Row 4: Top Accounts Bar Chart */}
      {data.topAccounts.length > 0 && (
        <ChartSection title="Top Accounts by Balance" subtitle="Highest-value accounts across all types">
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
            <BarChart data={data.topAccounts} layout="vertical" margin={{ top: 5, right: 20, left: isMobile ? 80 : 120, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₵${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 9 : 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={isMobile ? 78 : 115} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="balance" name="Balance" radius={[0, 6, 6, 0]} barSize={20}>
                {data.topAccounts.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Row 5: Financial Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>

        <ChartSection title="💡 Financial Insights" subtitle="AI-powered analysis of your current position">
          <div>
            {data.insights.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
          </div>
        </ChartSection>

        <ChartSection title="📊 Key Ratios" subtitle="Financial health indicators">
          <div>
            {[
              {
                label: 'Profit Margin',
                value: `${data.profitMargin}%`,
                bar: Math.min(Number(data.profitMargin), 100),
                color: Number(data.profitMargin) >= 15 ? '#16A34A' : Number(data.profitMargin) >= 5 ? '#D97706' : '#DC2626',
                benchmark: 'Target: 15%+',
              },
              {
                label: 'Debt-to-Asset Ratio',
                value: `${data.debtRatio}%`,
                bar: Math.min(Number(data.debtRatio), 100),
                color: Number(data.debtRatio) <= 40 ? '#16A34A' : Number(data.debtRatio) <= 60 ? '#D97706' : '#DC2626',
                benchmark: 'Target: under 50%',
              },
              {
                label: 'Receivables to Revenue',
                value: data.totalRevenue > 0 ? `${((data.arBalance / data.totalRevenue) * 100).toFixed(1)}%` : '0%',
                bar: data.totalRevenue > 0 ? Math.min((data.arBalance / data.totalRevenue) * 100, 100) : 0,
                color: data.arBalance / data.totalRevenue < 0.3 ? '#16A34A' : '#D97706',
                benchmark: 'Target: under 30%',
              },
              {
                label: 'Cash Coverage',
                value: data.totalLiability > 0 ? `${((data.cashBalance / data.totalLiability) * 100).toFixed(1)}%` : '100%',
                bar: data.totalLiability > 0 ? Math.min((data.cashBalance / data.totalLiability) * 100, 100) : 100,
                color: data.cashBalance >= data.totalLiability ? '#16A34A' : '#DC2626',
                benchmark: 'Target: 100%+',
              },
            ].map((ratio, i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#1A3560', fontWeight: 600 }}>{ratio.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: ratio.color }}>{ratio.value}</span>
                </div>
                <div style={{ height: 8, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden', marginBottom: 3 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(ratio.bar, 2)}%` }}
                    transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: 4, background: ratio.color }}
                  />
                </div>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{ratio.benchmark}</p>
              </div>
            ))}
          </div>
        </ChartSection>
      </div>

      {/* Footer note */}
      <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
        Analytics are based on posted journal entries and active accounts. Refresh the page to update.
      </p>
    </div>
  );
}