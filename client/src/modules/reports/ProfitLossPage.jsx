import { useState, useEffect, useRef } from 'react';
import reportService from '../../services/reportService';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { ReportHeader, DateRangePicker, ExportBar, exportToCSV, printReport, exportToExcelStyled } from './ReportShared';

const fmt = (n) => 'GHS ' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProfitLossPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // category -> bool (drill-down)
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
    const push = (a, b, c) => rows.push([a, b, c == null ? '' : Number(c).toFixed(2)]);
    push('REVENUE', '', '');
    report.revenue.items.forEach((i) => push(i.code, i.name, i.balance));
    push('', 'Total Revenue', report.revenue.total);
    push('COST OF SALES', '', '');
    report.costOfGoodsSold.items.forEach((i) => push(i.code, i.name, i.balance));
    push('', 'Total Cost of Sales', report.costOfGoodsSold.total);
    push('', 'GROSS PROFIT', report.grossProfit);
    push('OPERATING EXPENSES', '', '');
    (report.operatingExpenseGroups || []).forEach((g) => {
      push('  ' + g.category, '', '');
      g.items.forEach((i) => push(i.code, i.name, i.balance));
      push('', '  Total ' + g.category, g.total);
    });
    push('', 'Total Operating Expenses', report.operatingExpensesTotal);
    push('', 'OPERATING PROFIT', report.operatingProfit);
    if (report.otherIncome?.total) push('', 'Other Income', report.otherIncome.total);
    if (report.financeCosts?.total) push('', 'Finance Costs', report.financeCosts.total);
    push('', 'PROFIT BEFORE TAX', report.profitBeforeTax);
    if (report.taxExpense?.total) push('', 'Tax', report.taxExpense.total);
    push('', 'NET PROFIT', report.netProfit);
    exportToCSV('income_statement', ['Code', 'Account', 'Amount'], rows);
  };

  const th = { textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#6B7280', fontWeight: 600 };
  const line = { display: 'flex', justifyContent: 'space-between', padding: '7px 12px', fontSize: 14 };
  const subtotal = { ...line, fontWeight: 700, borderTop: '1px solid #E5E7EB', color: 'var(--text-primary,#111827)' };
  const majorTotal = { ...line, fontWeight: 800, background: 'var(--surface-alt,#F2F6FC)', borderTop: '2px solid var(--brand,#3485E9)', color: 'var(--deep-navy,#012158)', fontSize: 15 };
  const catRow = { ...line, fontWeight: 600, cursor: 'pointer', background: '#FAFBFC' };
  const itemRow = { ...line, color: '#4B5563', paddingLeft: 28 };

  return (
    <div>
      {ToastComponent}
      <ReportHeader title="Income Statement (Profit & Loss)" />
      <DateRangePicker startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} />
      <ExportBar onCSV={handleCSV} onPrint={handlePrint} onExcel={() => {}} />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : !report ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No data.</div>
      ) : (
        <div ref={printRef} style={{ background: 'var(--surface,#fff)', border: '1px solid var(--border,#E5E7EB)', borderRadius: 12, overflow: 'hidden', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ padding: '16px 12px 4px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--deep-navy,#012158)' }}>{companyName}</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Income Statement</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>For the period {startDate} to {endDate}</div>
          </div>

          {/* Revenue */}
          <div style={{ ...th, marginTop: 8 }}>REVENUE</div>
          {report.revenue.items.map((i) => (
            <div key={i.code} style={itemRow}><span>{i.code} · {i.name}</span><span>{fmt(i.balance)}</span></div>
          ))}
          <div style={subtotal}><span>Total Revenue</span><span>{fmt(report.revenue.total)}</span></div>

          {/* COGS */}
          <div style={{ ...th, marginTop: 8 }}>COST OF SALES</div>
          {report.costOfGoodsSold.items.map((i) => (
            <div key={i.code} style={itemRow}><span>{i.code} · {i.name}</span><span>{fmt(i.balance)}</span></div>
          ))}
          <div style={subtotal}><span>Total Cost of Sales</span><span>({fmt(report.costOfGoodsSold.total)})</span></div>

          <div style={majorTotal}><span>GROSS PROFIT</span><span>{fmt(report.grossProfit)}</span></div>

          {/* Operating expenses — grouped by category, click to drill down */}
          <div style={{ ...th, marginTop: 8 }}>OPERATING EXPENSES</div>
          {(report.operatingExpenseGroups || []).map((g) => (
            <div key={g.category}>
              <div style={catRow} onClick={() => toggle(g.category)}>
                <span>{expanded[g.category] ? '▾' : '▸'} {g.category}</span>
                <span>({fmt(g.total)})</span>
              </div>
              {expanded[g.category] && g.items.map((i) => (
                <div key={i.code} style={itemRow}><span>{i.code} · {i.name}</span><span>{fmt(i.balance)}</span></div>
              ))}
            </div>
          ))}
          <div style={subtotal}><span>Total Operating Expenses</span><span>({fmt(report.operatingExpensesTotal)})</span></div>

          <div style={majorTotal}><span>OPERATING PROFIT</span><span>{fmt(report.operatingProfit)}</span></div>

          {/* Other income / finance / other expense */}
          {report.otherIncome?.total > 0 && (
            <div style={line}><span>Add: Other Income</span><span>{fmt(report.otherIncome.total)}</span></div>
          )}
          {report.financeCosts?.total > 0 && (
            <div style={line}><span>Less: Finance Costs</span><span>({fmt(report.financeCosts.total)})</span></div>
          )}
          {report.otherExpenses?.total > 0 && (
            <div style={line}><span>Less: Other Expenses</span><span>({fmt(report.otherExpenses.total)})</span></div>
          )}

          <div style={majorTotal}><span>PROFIT BEFORE TAX</span><span>{fmt(report.profitBeforeTax)}</span></div>

          {report.taxExpense?.total > 0 && (
            <div style={line}><span>Less: Tax</span><span>({fmt(report.taxExpense.total)})</span></div>
          )}

          <div style={{ ...majorTotal, background: report.netProfit >= 0 ? '#EAF7EE' : '#FDECEC', color: report.netProfit >= 0 ? '#065F46' : '#991B1B', borderTop: '2px solid ' + (report.netProfit >= 0 ? '#16A34A' : '#DC2626') }}>
            <span>NET PROFIT FOR THE PERIOD</span><span>{fmt(report.netProfit)}</span>
          </div>
          <div style={{ height: 12 }} />
        </div>
      )}
    </div>
  );
}
