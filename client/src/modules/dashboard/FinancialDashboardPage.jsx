// client/src/modules/dashboard/FinancialDashboardPage.jsx
//
// Interactive Financial Management dashboard. All figures come from the server
// analytics endpoint (/api/analytics/dashboard), which computes KPIs, ratios and
// monthly series from the POSTED ledger — so the numbers reconcile with the
// Balance Sheet / P&L reports. Branch scope is applied automatically by the API
// layer (X-Branch header from the top-bar switcher); the Year/Quarter filters
// below set the reporting period.
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { FiRefreshCw, FiArrowRight, FiDownload } from 'react-icons/fi';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useTenant } from '../../context/TenantContext';
import { exportToExcelStyled } from '../reports/ReportShared';

const C = {
  navy: '#1A3560', gold: '#C9A227', teal: '#0D9488', red: '#DC2626',
  green: '#16A34A', purple: '#7C3AED', orange: '#EA580C', amber: '#D97706',
  grey: '#6B7280', mute: '#9CA3AF', border: '#E2E8F0', surface: '#fff',
};

const money = (n) => formatCurrency(Number(n) || 0, 'GHS');
const pct = (n) => `${(Number(n) || 0).toFixed(2)}%`;
const ratio = (n) => (Number(n) || 0).toFixed(2);

const YEARS = (() => { const y = new Date().getFullYear(); return [y, y - 1, y - 2, y - 3]; })();
const QUARTERS = [{ v: '', l: 'Full year / all' }, { v: '1', l: 'Q1' }, { v: '2', l: 'Q2' }, { v: '3', l: 'Q3' }, { v: '4', l: 'Q4' }];

// ── small presentational pieces ──
// `onClick` makes a card a drill-down: it gets a pointer cursor, a subtle hover
// lift, and a "View details" hint so users know it opens the backing report.
function Stat({ label, value, accent, sub, onClick }) {
  const [hover, setHover] = useState(false);
  const clickable = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => clickable && setHover(true)}
      onMouseLeave={() => clickable && setHover(false)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      title={clickable ? 'View details' : undefined}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderLeft: `4px solid ${accent}`,
        borderRadius: 10, padding: '16px 18px', position: 'relative',
        cursor: clickable ? 'pointer' : 'default',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 10px 26px rgba(26,53,96,0.12)' : 'none',
        transition: 'transform 160ms, box-shadow 160ms',
      }}
    >
      <p style={{ fontSize: 11, color: C.mute, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: C.navy, margin: 0, fontFamily: 'var(--font-heading)' }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: C.mute, margin: '4px 0 0' }}>{sub}</p>}
      {clickable && (
        <span style={{
          position: 'absolute', right: 12, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
          color: accent, opacity: hover ? 1 : 0.55, transition: 'opacity 160ms',
        }}>
          Details <FiArrowRight size={11} />
        </span>
      )}
    </div>
  );
}

function Panel({ title, subtitle, children, style }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, ...style }}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: C.mute, margin: '2px 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// Semicircular gauge for a 0–100 percentage.
function Gauge({ value, caption }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const fill = v >= 40 ? C.green : v >= 20 ? C.amber : C.red;
  const data = [{ name: 'v', value: v, fill }];
  return (
    <div style={{ position: 'relative', height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="68%" outerRadius="100%" startAngle={180} endAngle={0} data={data} barSize={22}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#F1F5F9' }} dataKey="value" cornerRadius={11} angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 28, pointerEvents: 'none' }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: fill }}>{v.toFixed(1)}%</span>
        {caption && <span style={{ fontSize: 12, color: C.mute }}>{caption}</span>}
      </div>
    </div>
  );
}

const tooltipStyle = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 };

export default function FinancialDashboardPage() {
  const navigate = useNavigate();
  const { companyName } = useTenant();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Drill-down: each KPI opens the report that backs it. AR/AP/Cash/Inventory
  // open the General Ledger pre-filtered to the control-account code; the P&L
  // and Balance Sheet carry the same reporting period as the dashboard filters.
  const period = `?${new URLSearchParams({ ...(year ? { year } : {}), ...(quarter ? { quarter } : {}) }).toString()}`;
  const toLedger = (code) => () => navigate(`/reports/general-ledger?code=${code}`);
  const toPL = () => navigate(`/reports/profit-loss${period === '?' ? '' : period}`);
  const toBS = () => navigate(`/reports/balance-sheet${period === '?' ? '' : period}`);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (year) params.year = year;
      if (quarter) params.quarter = quarter;
      const { data: res } = await api.get('/analytics/dashboard', { params });
      if (res.success) setData(res.data);
      else setError(res.message || 'Could not load the dashboard.');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load the dashboard.');
    } finally { setLoading(false); }
  }, [year, quarter]);

  useEffect(() => { load(); }, [load]);

  const k = data?.kpis || {};
  const s = data?.series || {};
  const sel = { padding: '8px 10px', borderRadius: 8, border: `1px solid #D1D5DB`, fontSize: 14, background: '#fff' };

  // Export the dashboard figures to a styled .xlsx (same look as the reports).
  // Money rows go out as numbers so Excel can sum/filter them; ratios and
  // percentages go as display strings.
  const exportExcel = async () => {
    if (!data) return;
    const n = (x) => Math.round((Number(x) || 0) * 100) / 100;
    const period = data.period === 'All time'
      ? 'All time'
      : `Period ending ${new Date(data.period.end).toLocaleDateString('en-GB')}`;
    const columns = [
      { header: 'Item', key: 'item', width: 42 },
      { header: 'Value', key: 'value', width: 24, money: true, align: 'right' },
    ];
    const sections = [
      { label: 'Key Financial Indicators', rows: [
        { item: 'Accounts Receivable', value: n(k.accountsReceivable) },
        { item: 'Accounts Payable', value: n(k.accountsPayable) },
        { item: 'Cash & Bank', value: n(k.cash) },
        { item: 'Inventory', value: n(k.inventory) },
        { item: 'Revenue (period)', value: n(k.revenue) },
        { item: 'Gross Profit', value: n(k.grossProfit) },
        { item: 'Net Income (period)', value: n(k.netIncome) },
        { item: 'Working Capital', value: n(k.workingCapital) },
        { item: 'Total Assets', value: n(k.totalAssets) },
        { item: 'Total Liabilities', value: n(k.totalLiabilities) },
        { item: 'Total Equity', value: n(k.totalEquity) },
        { item: 'Burn Rate (avg monthly opex)', value: n(k.burnRate) },
      ] },
      { label: 'Ratios', rows: [
        { item: 'Gross Profit Margin', value: pct(k.grossProfitMargin) },
        { item: 'Equity Ratio', value: pct(k.equityRatio) },
        { item: 'Current Ratio', value: ratio(k.currentRatio) },
        { item: 'Quick Ratio', value: ratio(k.quickRatio) },
        { item: 'AR Turnover', value: ratio(k.arTurnover) },
        { item: 'AP Turnover', value: ratio(k.apTurnover) },
      ] },
    ];
    if ((s.revenueByMonth || []).length)
      sections.push({ label: 'Revenue by Month', rows: s.revenueByMonth.map((m) => ({ item: m.month, value: n(m.value) })) });
    if ((s.inventoryTrend || []).length)
      sections.push({ label: 'Inventory (month-end)', rows: s.inventoryTrend.map((m) => ({ item: m.month, value: n(m.value) })) });
    if ((s.arApTurnover || []).length)
      sections.push({ label: 'AR / AP Turnover by Month', rows: s.arApTurnover.map((m) => ({ item: m.month, value: `AR ${ratio(m.arTurnover)}  /  AP ${ratio(m.apTurnover)}` })) });

    await exportToExcelStyled({
      filename: 'financial_dashboard',
      companyName,
      title: 'Financial Management Dashboard',
      subtitle: period,
      columns,
      sections,
    });
  };

  return (
    <div style={{ maxWidth: 1180 }}>
      {/* Header + filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>Financial Management Dashboard</h1>
          <p style={{ fontSize: 13, color: C.grey, margin: '4px 0 0' }}>
            {data ? (data.period === 'All time' ? 'All time' : `Period ending ${new Date(data.period.end).toLocaleDateString('en-GB')}`) : 'Loading…'}
            {data && <span style={{ color: C.mute }}> · refreshed {new Date(data.generatedAt).toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: C.grey }}>Year
            <select style={{ ...sel, marginLeft: 6 }} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: C.grey }}>Quarter
            <select style={{ ...sel, marginLeft: 6 }} value={quarter} onChange={(e) => setQuarter(e.target.value)} disabled={!year}>
              {QUARTERS.map((q) => <option key={q.v} value={q.v}>{q.l}</option>)}
            </select>
          </label>
          <button onClick={load} title="Refresh" style={{ ...sel, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FiRefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportExcel} title="Export to Excel" disabled={!data}
            style={{ ...sel, cursor: data ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 6,
                     border: '1px solid #C9A227', color: '#B8860B', fontWeight: 600, opacity: data ? 1 : 0.5 }}>
            <FiDownload size={14} /> Export Excel
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontSize: 14, marginBottom: 16 }}>{error}</div>
      )}
      {loading && !data ? (
        <div style={{ padding: 40, color: C.grey }}>Loading dashboard…</div>
      ) : data && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 16 }}>
            <Stat label="Accounts Receivable" value={money(k.accountsReceivable)} accent={C.teal} sub="per-person ledgers" onClick={() => navigate('/ledgers')} />
            <Stat label="Accounts Payable" value={money(k.accountsPayable)} accent={C.red} sub="per-person ledgers" onClick={() => navigate('/ledgers')} />
            <Stat label="Revenue" value={money(k.revenue)} accent={C.green} sub="selected period" onClick={toPL} />
            <Stat label="Equity Ratio" value={pct(k.equityRatio)} accent={C.purple} sub="equity ÷ assets" onClick={toBS} />
            <Stat label="Current Ratio" value={ratio(k.currentRatio)} accent={C.navy} sub="CA ÷ CL" onClick={toBS} />
            <Stat label="Burn Rate" value={money(k.burnRate)} accent={C.orange} sub="avg monthly opex" onClick={toPL} />
          </div>

          {/* Gauge + secondary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: 16, marginBottom: 16 }}>
            <Panel title="Gross Profit Margin" subtitle="(Revenue − COGS) ÷ Revenue">
              <Gauge value={k.grossProfitMargin} caption="gross margin" />
            </Panel>
            <Panel title="Position at a glance">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <Stat label="Cash & Bank" value={money(k.cash)} accent={C.teal} onClick={toLedger('1000')} />
                <Stat label="Inventory" value={money(k.inventory)} accent={C.amber} onClick={toLedger('1200')} />
                <Stat label="Working Capital" value={money(k.workingCapital)} accent={C.green} onClick={toBS} />
                <Stat label="Net Income" value={money(k.netIncome)} accent={k.netIncome >= 0 ? C.green : C.red} sub="selected period" onClick={toPL} />
                <Stat label="Quick Ratio" value={ratio(k.quickRatio)} accent={C.navy} sub="(CA − Inv) ÷ CL" onClick={toBS} />
                <Stat label="Total Assets" value={money(k.totalAssets)} accent={C.purple} onClick={toBS} />
              </div>
            </Panel>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, marginBottom: 16 }}>
            <Panel title="Inventory" subtitle="month-end, last 6 months">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={s.inventoryTrend || []} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.grey }} />
                  <YAxis tick={{ fontSize: 11, fill: C.grey }} width={70} tickFormatter={(v) => money(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} />
                  <Line type="monotone" dataKey="value" name="Inventory" stroke={C.amber} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="AR vs AP Turnover" subtitle="monthly, last 6 months">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={s.arApTurnover || []} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.grey }} />
                  <YAxis tick={{ fontSize: 11, fill: C.grey }} width={40} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => ratio(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="arTurnover" name="AR turnover" fill={C.teal} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="apTurnover" name="AP turnover" fill={C.purple} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Revenue by Month" subtitle="last 6 months">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={s.revenueByMonth || []} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.grey }} />
                  <YAxis tick={{ fontSize: 11, fill: C.grey }} width={70} tickFormatter={(v) => money(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} />
                  <Bar dataKey="value" name="Revenue" fill={C.green} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <p style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>
            Figures are computed from the posted ledger and reconcile with the Balance Sheet / P&amp;L reports. Current vs non-current is classified by account-code range; burn rate is average monthly operating expense over the selected period.
          </p>
        </>
      )}
    </div>
  );
}
