// client/src/modules/ledgers/PartyStatementPage.jsx
//
// Statement of account for one party ledger. The table leads with the running
// balance (Details · Debit · Credit · Balance); the date/time, entry number,
// mode and voucher reference are revealed per row on click (drill-down), so the
// header stays clean — exactly as requested. Balance is shown with a Dr/Cr tag:
// Dr = the party owes us, Cr = we owe the party.
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import api from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { DateRangePicker, ExportBar, exportToExcelStyled, printReport } from '../reports/ReportShared';

const C = {
  navy: '#1A3560', gold: '#C9A227', teal: '#0D9488', red: '#DC2626',
  green: '#16A34A', grey: '#6B7280', mute: '#9CA3AF', border: '#E2E8F0', surface: '#fff',
};
const money = (n) => formatCurrency(Math.abs(Number(n) || 0), 'GHS');
const balTag = (n) => `${money(n)} ${Number(n) >= 0 ? 'Dr' : 'Cr'}`;
const dateTime = (d) => {
  try { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return formatDate(d); }
};

export default function PartyStatementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyName } = useTenant();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [open, setOpen] = useState({}); // row index -> expanded

  const load = useCallback(() => {
    setLoading(true); setError('');
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    api.get(`/ledgers/parties/${id}/statement`, { params })
      .then((res) => { if (res.data?.success) setData(res.data.data); else setError(res.data?.message || 'Could not load the statement.'); })
      .catch((e) => setError(e.response?.data?.message || 'Could not load the statement.'))
      .finally(() => setLoading(false));
  }, [id, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const party = data?.party;
  const rows = data?.rows || [];

  const handleExcel = async () => {
    if (!data) return;
    const columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Entry #', key: 'entry', width: 14 },
      { header: 'Details', key: 'details', width: 40 },
      { header: 'Mode', key: 'mode', width: 12 },
      { header: 'Ref', key: 'ref', width: 16 },
      { header: 'Debit', key: 'debit', width: 15, money: true },
      { header: 'Credit', key: 'credit', width: 15, money: true },
      { header: 'Balance', key: 'balance', width: 16, money: true },
    ];
    const dataRows = [
      { details: 'Opening balance', balance: party.openingBalance },
      ...rows.map((r) => ({
        date: dateTime(r.date), entry: r.entryNumber, details: r.description,
        mode: r.mode, ref: r.reference,
        debit: r.debit > 0 ? r.debit : '', credit: r.credit > 0 ? r.credit : '',
        balance: r.balance,
      })),
    ];
    await exportToExcelStyled({
      filename: `statement_${party.externalPartyId || party.code}`,
      companyName,
      title: `Statement of Account — ${party.name}`,
      subtitle: `${party.externalPartyId ? 'ID ' + party.externalPartyId + ' · ' : ''}${data.period === 'All time' ? 'All time' : `${formatDate(startDate)} to ${formatDate(endDate)}`}`,
      columns,
      sections: [{
        rows: dataRows,
        totalLabel: 'Closing balance',
        totalLabelKey: 'details',
        totalValues: { balance: party.closingBalance },
      }],
    });
  };

  const sideColor = party && party.side === 'payable' ? C.red : C.teal;

  return (
    <div style={{ maxWidth: 1050 }}>
      <button onClick={() => navigate('/ledgers')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.grey, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 14 }}>
        <FiArrowLeft size={14} /> All party ledgers
      </button>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {loading && !data ? (
        <div style={{ padding: 40, color: C.grey }}>Loading statement…</div>
      ) : party && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>{party.name}</h1>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: sideColor, background: `${sideColor}15`, padding: '3px 10px', borderRadius: 20 }}>
                  {party.side === 'payable' ? 'We owe' : 'Owes us'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: C.grey, margin: '4px 0 0' }}>
                {party.externalPartyId && <>ID <strong style={{ fontFamily: 'monospace' }}>{party.externalPartyId}</strong> · </>}
                ledger <span style={{ fontFamily: 'monospace' }}>{party.code}</span> · closing balance <strong style={{ color: sideColor }}>{balTag(party.closingBalance)}</strong>
              </p>
            </div>
            <ExportBar onPrint={() => printReport(document.getElementById('party-statement-print'), `Statement — ${party.name}`)} onExportExcel={handleExcel} />
          </div>

          {/* Date range */}
          <div style={{ marginBottom: 16 }}>
            <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
          </div>

          {/* Statement table */}
          <div id="party-statement-print" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: C.navy, color: '#fff' }}>
                  <th style={{ width: 28 }} />
                  <th style={{ textAlign: 'left', padding: '11px 14px', fontWeight: 600 }}>Details</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontWeight: 600, width: 130 }}>Debit</th>
                  <th style={{ textAlign: 'right', padding: '11px 14px', fontWeight: 600, width: 130 }}>Credit</th>
                  <th style={{ textAlign: 'right', padding: '11px 16px', fontWeight: 600, width: 150 }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance */}
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#F8FAFC' }}>
                  <td />
                  <td style={{ padding: '10px 14px', fontStyle: 'italic', color: C.grey }}>Opening balance</td>
                  <td /><td />
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: C.grey }}>{balTag(party.openingBalance)}</td>
                </tr>

                {rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: C.mute }}>No transactions in this period.</td></tr>
                ) : rows.map((r, i) => {
                  const isOpen = !!open[i];
                  return (
                    <Fragment key={i}>
                      <tr
                        onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                        style={{ borderBottom: isOpen ? 'none' : `1px solid ${C.border}`, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ textAlign: 'center', color: C.mute }}>{isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}</td>
                        <td style={{ padding: '11px 14px', color: C.navy }}>{r.description || <span style={{ color: C.mute }}>—</span>}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: r.debit > 0 ? C.navy : C.mute }}>{r.debit > 0 ? money(r.debit) : '—'}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: r.credit > 0 ? C.navy : C.mute }}>{r.credit > 0 ? money(r.credit) : '—'}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, color: r.balance >= 0 ? C.teal : C.red }}>{balTag(r.balance)}</td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: '#FbFcFe' }}>
                          <td />
                          <td colSpan={4} style={{ padding: '4px 14px 12px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', fontSize: 12, color: C.grey }}>
                              <span><strong style={{ color: C.navy }}>Date:</strong> {dateTime(r.date)}</span>
                              <span><strong style={{ color: C.navy }}>Entry:</strong> {r.entryNumber}</span>
                              {r.reference && <span><strong style={{ color: C.navy }}>Ref:</strong> {r.reference}</span>}
                              {r.mode && <span><strong style={{ color: C.navy }}>Mode:</strong> {r.mode}</span>}
                              {r.voucherType && <span><strong style={{ color: C.navy }}>Type:</strong> {r.voucherType}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {/* Closing balance */}
                <tr style={{ background: '#F1F5F9', borderTop: `2px solid ${C.navy}` }}>
                  <td />
                  <td style={{ padding: '12px 14px', fontWeight: 800, color: C.navy }}>Closing balance</td>
                  <td /><td />
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: party.closingBalance >= 0 ? C.teal : C.red }}>{balTag(party.closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </>
      )}
    </div>
  );
}
