import { useState, useEffect, useRef } from 'react';
import reportService from '../../services/reportService';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { ReportHeader, DateRangePicker, ExportBar, exportToCSV, printReport, exportToExcelStyled } from './ReportShared';

export default function ProfitLossPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { companyName, settings } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const printRef = useRef(null);

  const fetchReport = () => {
    setLoading(true);
    reportService.profitLoss(startDate, endDate)
      .then((r) => { if (r.success) setReport(r.data); })
      .catch(() => showToast('Failed to load report', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchReport(); }, [startDate, endDate]);

  const toggle = (cat) => setExpanded((e) => ({ ...e, [cat]: !e[cat] }));
  const handlePrint = () => printReport(printRef.current, 'Income Statement');

  const handleCSV = () => {
    if (!report) return;
    const rows = [];
    const push = (a, b) => rows.push([a, b == null ? '' : Number(b).toFixed(2)]);
    push('--- REVENUE ---', '');
    report.revenue.items.forEach((i) => push(`${i.code} ${i.name}`, i.balance));
    push('Total Revenue', report.revenue.total);
    push('--- COST OF SALES ---', '');
    report.costOfGoodsSold.items.forEach((i) => push(`${i.code} ${i.name}`, i.balance));
    push('Total Cost of Sales', report.costOfGoodsSold.total);
    push('GROSS PROFIT', report.grossProfit);
    push('--- OPERATING EXPENSES ---', '');
    (report.operatingExpenseGroups || []).forEach((g) => {
      push(`  ${g.category}`, '');
      g.items.forEach((i) => push(`${i.code} ${i.name}`, i.balance));
      push(`  Total ${g.category}`, g.total);
    });
    push('Total Operating Expenses', report.operatingExpensesTotal);
    push('OPERATING PROFIT', report.operatingProfit);
    if (report.otherIncome?.total) push('Add: Other Income', report.otherIncome.total);
    if (report.financeCosts?.total) push('Less: Finance Costs', report.financeCosts.total);
    if (report.otherExpenses?.total) push('Less: Other Expenses', report.otherExpenses.total);
    push('PROFIT BEFORE TAX', report.profitBeforeTax);
    if (report.taxExpense?.total) push('Less: Tax', report.taxExpense.total);
    push('NET PROFIT FOR THE PERIOD', report.netProfit);
    exportToCSV('income_statement', ['Account', 'Amount (GHS)'], rows);
  };

  const handleExcel = async () => {
    if (!report) return;
    const columns = [
      { header: 'Code', key: 'code', width: 12 },
      { header: 'Account', key: 'name', width: 44 },
      { header: 'Amount', key: 'amount', width: 18, money: true },
    ];
    const flat = (label, block, totalLabel) => ({
      bandValues: { code: '', name: label },
      rows: (block.items || []).map((i) => ({ code: i.code, name: i.name, amount: i.balance })),
      totalLabel, totalLabelKey: 'name', totalValues: { amount: block.total },
    });
    const totalOnly = (label, amount) => ({ rows: [], totalLabel: label, totalLabelKey: 'name', totalValues: { amount } });
    const sections = [
      flat('REVENUE', report.revenue, 'Total Revenue'),
      flat('COST OF SALES', report.costOfGoodsSold, 'Total Cost of Sales'),
      totalOnly('GROSS PROFIT', report.grossProfit),
    ];
    (report.operatingExpenseGroups || []).forEach((g) => {
      sections.push({ bandValues: { code: '', name: g.category }, rows: g.items.map((i) => ({ code: i.code, name: i.name, amount: i.balance })), totalLabel: `Total ${g.category}`, totalLabelKey: 'name', totalValues: { amount: g.total } });
    });
    sections.push(totalOnly('OPERATING PROFIT', report.operatingProfit));
    sections.push(totalOnly('PROFIT BEFORE TAX', report.profitBeforeTax));
    sections.push(totalOnly('NET PROFIT FOR THE PERIOD', report.netProfit));
    await exportToExcelStyled({
      filename: 'income_statement', companyName,
      title: 'Income Statement (Profit & Loss)',
      subtitle: `For the period ${startDate} to ${endDate}`,
      columns, sections,
    });
  };

  // ── row renderers (match Balance Sheet's table styling) ──
  const SectionHead = ({ title }) => (
    <tr style={{ background: 'var(--bg-app)' }}>
      <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, color: 'var(--deep-navy)' }}>{title}</td>
    </tr>
  );
  const ItemRow = ({ code, name, amount, indent = 28 }) => (
    <tr style={{ borderBottom: '1px solid #F5F5F5' }}>
      <td style={{ padding: `8px 12px 8px ${indent}px`, fontSize: 13 }}>
        {code && <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginRight: 8, fontSize: 12 }}>{code}</span>}
        {name}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{Number(amount).toFixed(2)}</td>
    </tr>
  );
  const SubtotalRow = ({ label, amount, paren }) => (
    <tr style={{ borderBottom: '2px solid var(--border)' }}>
      <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{label}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{paren ? `(${Number(amount).toFixed(2)})` : Number(amount).toFixed(2)}</td>
    </tr>
  );
  const MajorRow = ({ label, amount, tone }) => {
    const bg = tone === 'good' ? '#D1FAE5' : tone === 'bad' ? '#FEE2E2' : 'var(--bg-app)';
    const color = tone === 'good' ? '#065F46' : tone === 'bad' ? '#991B1B' : 'var(--deep-navy)';
    return (
      <tr style={{ background: bg, borderTop: '3px solid var(--deep-navy)' }}>
        <td style={{ padding: '14px 12px', fontWeight: 800, fontSize: 14, color }}>{label}</td>
        <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color }}>{Number(amount).toFixed(2)}</td>
      </tr>
    );
  };

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>Generating report...</p>;
  if (!report) return <p style={{ padding: 40, color: 'var(--text-muted)' }}>No data.</p>;

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Profit &amp; Loss</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
          <ExportBar onPrint={handlePrint} onExportExcel={handleExcel} />
        </div>
      </div>

      <div ref={printRef} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 32 }}>
        <ReportHeader title="Income Statement (Profit & Loss)" subtitle={`For the period ${startDate} to ${endDate}`} companyName={companyName} settings={settings} />

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {/* Revenue */}
            <SectionHead title="Revenue" />
            {report.revenue.items.map((i) => <ItemRow key={i.code} code={i.code} name={i.name} amount={i.balance} />)}
            <SubtotalRow label="Total Revenue" amount={report.revenue.total} />

            {/* Cost of sales */}
            <SectionHead title="Cost of Sales" />
            {report.costOfGoodsSold.items.map((i) => <ItemRow key={i.code} code={i.code} name={i.name} amount={i.balance} />)}
            <SubtotalRow label="Total Cost of Sales" amount={report.costOfGoodsSold.total} paren />

            <MajorRow label="GROSS PROFIT" amount={report.grossProfit} />

            {/* Operating expenses grouped by category (click to drill down) */}
            <SectionHead title="Operating Expenses" />
            {(report.operatingExpenseGroups || []).map((g) => (
              <>
                <tr key={g.category} style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer', background: '#FAFBFC' }} onClick={() => toggle(g.category)}>
                  <td style={{ padding: '8px 12px 8px 20px', fontSize: 13, fontWeight: 600 }}>{expanded[g.category] ? '▾' : '▸'} {g.category}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>({g.total.toFixed(2)})</td>
                </tr>
                {expanded[g.category] && g.items.map((i) => <ItemRow key={i.code} code={i.code} name={i.name} amount={i.balance} indent={40} />)}
              </>
            ))}
            <SubtotalRow label="Total Operating Expenses" amount={report.operatingExpensesTotal} paren />

            <MajorRow label="OPERATING PROFIT" amount={report.operatingProfit} />

            {report.otherIncome?.total > 0 && <ItemRow name="Add: Other Income" amount={report.otherIncome.total} indent={12} />}
            {report.financeCosts?.total > 0 && <ItemRow name="Less: Finance Costs" amount={report.financeCosts.total} indent={12} />}
            {report.otherExpenses?.total > 0 && <ItemRow name="Less: Other Expenses" amount={report.otherExpenses.total} indent={12} />}

            <MajorRow label="PROFIT BEFORE TAX" amount={report.profitBeforeTax} />

            {report.taxExpense?.total > 0 && <ItemRow name="Less: Tax" amount={report.taxExpense.total} indent={12} />}

            <MajorRow label="NET PROFIT FOR THE PERIOD" amount={report.netProfit} tone={report.netProfit >= 0 ? 'good' : 'bad'} />
          </tbody>
        </table>
      </div>
    </div>
  );
}