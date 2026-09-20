// client/src/modules/vouchers/VoucherViewPage.jsx
// Professional, printable voucher DOCUMENT — company header (logo + info),
// bordered layout, itemized table, totals. Plus actions (post/reverse) and
// source-document attachments. The document area prints cleanly.
//
// Journal Vouchers get a dedicated multi-line Debit/Credit table (Account |
// Description | Debit | Credit) with a balanced TOTAL footer, and the party /
// payment-mode strip + single-total block are hidden (a JV has neither).
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiCornerDownLeft, FiPrinter } from 'react-icons/fi';
import voucherService from '../../services/voucherService';
import VoucherAttachments from './VoucherAttachments';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

const NAVY = '#012158', GOLD = '#FD9C09', BLUE = '#3485E9';
const TYPE_LABELS = {
  payment: 'Payment Voucher', receipt: 'Receipt Voucher', contra: 'Contra Voucher',
  transfer: 'Transfer Voucher', journal: 'Journal Voucher', purchase: 'Purchase Voucher',
  sales: 'Sales Voucher', debit_note: 'Debit Note', credit_note: 'Credit Note',
};
const MODE_LABELS = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', mobile_money: 'Mobile Money', card: 'Card', other: 'Other' };
const statusStyle = (s) => ({
  draft: { bg: '#FEF3C7', color: '#92400E', label: 'Draft' },
  awaiting_approval: { bg: '#DBEAFE', color: '#1E40AF', label: 'Awaiting Approval' },
  posted: { bg: '#D1FAE5', color: '#065F46', label: 'Posted' },
  reversed: { bg: '#FEE2E2', color: '#991B1B', label: 'Reversed' },
}[s] || { bg: '#EEE', color: '#333', label: s });

const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function VoucherViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyName, settings } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const { user } = useAuth();
  const canReverse = ['super_admin', 'admin'].includes(user?.role);
  const printRef = useRef(null);

  const [voucher, setVoucher] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    voucherService.getById(id)
      .then((r) => { if (r.success) setVoucher(r.data); else showToast(r.message || 'Not found', 'error'); })
      .catch(() => showToast('Failed to load voucher', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const handlePost = async () => {
    if (!window.confirm('Post this voucher? It will create a journal entry and update balances.')) return;
    try { const r = await voucherService.post(id); if (r.success) { showToast(r.message); load(); } else showToast(r.message, 'error'); }
    catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };
  const handleReverse = async () => {
    if (!window.confirm('Reverse this voucher? A reversing entry will be posted.')) return;
    try { const r = await voucherService.reverse(id); if (r.success) { showToast(r.message); load(); } else showToast(r.message, 'error'); }
    catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };
  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const w = window.open('', '_blank', 'width=900,height=1000');
    w.document.write(`<html><head><title>${voucher?.voucherNumber || 'Voucher'}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color:#222; margin:0; padding:24px; }
        table { width:100%; border-collapse:collapse; }
        @media print { .no-print { display:none; } }
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted, #9CA3AF)' }}>Loading voucher…</p>;
  if (!voucher) return <p style={{ padding: 40, color: 'var(--text-muted, #9CA3AF)' }}>Voucher not found.</p>;

  const s = statusStyle(voucher.status);
  const logo = settings?.logo;
  const lh = settings?.letterhead || {};
  const addr = [settings?.address, settings?.city, settings?.region].filter(Boolean).join(', ');
  const ghost = { padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

  const cellL = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #E5E7EB' };
  const th = { padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'left' };

  // Journal vouchers get their own document layout.
  const isJournal = voucher.voucherType === 'journal';
  const jvTotalDebit = (voucher.lines || []).reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const jvTotalCredit = (voucher.lines || []).reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {ToastComponent}

      {/* ── Toolbar (not printed) ── */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/vouchers')} style={ghost}><FiArrowLeft size={14} /> Back</button>
          <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handlePrint} style={{ ...ghost, borderColor: BLUE, color: BLUE }}><FiPrinter size={14} /> Print</button>
          {voucher.status === 'draft' && <button onClick={handlePost} style={{ ...ghost, color: '#065F46', borderColor: '#065F46' }}><FiCheckCircle size={14} /> Post</button>}
          {voucher.status === 'posted' && canReverse && <button onClick={handleReverse} style={{ ...ghost, color: '#B45309', borderColor: '#B45309' }}><FiCornerDownLeft size={14} /> Reverse</button>}
        </div>
      </div>

      {/* ── The printable voucher document ── */}
      <div ref={printRef} style={{ background: '#fff', border: `1px solid #D1D5DB`, borderRadius: 4, overflow: 'hidden' }}>
        {/* Header: logo + company info (left), voucher meta (right) */}
        <div style={{ display: 'flex', borderBottom: `3px solid ${NAVY}` }}>
          <div style={{ flex: 1, padding: 20, display: 'flex', gap: 16, alignItems: 'center', borderRight: '1px solid #E5E7EB' }}>
            {logo ? (
              <img src={logo} alt="logo" style={{ width: 76, height: 76, objectFit: 'contain', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 76, height: 76, borderRadius: 8, background: NAVY, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, flexShrink: 0 }}>
                {(companyName || 'NB').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: NAVY }}>{lh.companyName || companyName || 'Company'}</div>
              {addr && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{addr}</div>}
              {(lh.phone || lh.email) && (
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  {lh.phone && <span>{lh.phone}</span>}{lh.phone && lh.email && <span> · </span>}{lh.email && <span>{lh.email}</span>}
                </div>
              )}
            </div>
          </div>
          <div style={{ width: 220, padding: 20, background: '#F9FAFB' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, textTransform: 'uppercase', marginBottom: 10 }}>{TYPE_LABELS[voucher.voucherType] || voucher.voucherType}</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9CA3AF' }}>Voucher No.</span><strong>{voucher.voucherNumber}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9CA3AF' }}>Date</span><span>{formatDate(voucher.date)}</span></div>
              {voucher.dueDate && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9CA3AF' }}>Due Date</span><span>{formatDate(voucher.dueDate)}</span></div>}
            </div>
          </div>
        </div>

        {/* Party / details strip — not shown for journal vouchers (no party / mode) */}
        {!isJournal && (
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ flex: 1, padding: '14px 20px', borderRight: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Party</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{voucher.partyName || '—'}</div>
            </div>
            <div style={{ flex: 1, padding: '14px 20px' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Payment Mode</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{MODE_LABELS[voucher.mode] || voucher.mode}</div>
            </div>
          </div>
        )}

        {/* Body: journal table · itemized table · simple accounting */}
        <div style={{ padding: 20 }}>
          {isJournal ? (
            <table>
              <thead>
                <tr style={{ background: NAVY }}>
                  <th style={th}>Account</th>
                  <th style={th}>Description</th>
                  <th style={{ ...th, textAlign: 'right', width: 110 }}>Debit</th>
                  <th style={{ ...th, textAlign: 'right', width: 110 }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {(voucher.lines || []).map((l, i) => (
                  <tr key={i} style={{ background: i % 2 ? '#F9FAFB' : '#fff' }}>
                    <td style={cellL}><strong>{l.accountCode}</strong>{l.accountName ? ` · ${l.accountName}` : ''}</td>
                    <td style={cellL}>{l.description || ''}</td>
                    <td style={{ ...cellL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{(Number(l.debit) || 0) > 0 ? money(l.debit) : ''}</td>
                    <td style={{ ...cellL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{(Number(l.credit) || 0) > 0 ? money(l.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F3F4F6', borderTop: `2px solid ${NAVY}` }}>
                  <td style={{ ...cellL, fontWeight: 800, borderBottom: 'none' }} colSpan={2}>TOTAL</td>
                  <td style={{ ...cellL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, borderBottom: 'none' }}>{money(jvTotalDebit)}</td>
                  <td style={{ ...cellL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, borderBottom: 'none' }}>{money(jvTotalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          ) : voucher.isItemized && (voucher.lineItems || []).length > 0 ? (
            <table>
              <thead>
                <tr style={{ background: NAVY }}>
                  <th style={{ ...th, width: 36 }}>#</th>
                  <th style={th}>Description</th>
                  <th style={{ ...th, textAlign: 'right', width: 70 }}>Qty</th>
                  <th style={{ ...th, width: 70 }}>Unit</th>
                  <th style={{ ...th, textAlign: 'right' }}>Price/Unit</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {voucher.lineItems.map((it, i) => (
                  <tr key={i} style={{ background: i % 2 ? '#F9FAFB' : '#fff' }}>
                    <td style={cellL}>{i + 1}</td>
                    <td style={cellL}>{it.description}</td>
                    <td style={{ ...cellL, textAlign: 'right' }}>{it.quantity}</td>
                    <td style={cellL}>{it.unit}</td>
                    <td style={{ ...cellL, textAlign: 'right', fontFamily: 'monospace' }}>{money(it.unitPrice)}</td>
                    <td style={{ ...cellL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <tbody>
                {(voucher.lines || []).map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={cellL}>{l.accountCode} · {l.accountName}</td>
                    <td style={{ ...cellL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{l.debit > 0 ? `Dr ${money(l.debit)}` : `Cr ${money(l.credit)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals block (right-aligned) — not shown for journal vouchers (the JV table carries its own balanced total) */}
          {!isJournal && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <div style={{ width: 280 }}>
                {voucher.isItemized && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}><span style={{ color: '#6B7280' }}>Subtotal</span><span>{money(voucher.subtotal)}</span></div>
                    {(voucher.discount || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}><span style={{ color: '#6B7280' }}>Discount</span><span>−{money(voucher.discount)}</span></div>}
                  </>
                )}
                {voucher.vatEnabled && (voucher.vatAmount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}><span style={{ color: '#6B7280' }}>VAT ({voucher.vatRate}%)</span><span>{money(voucher.vatAmount)}</span></div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', marginTop: 4, background: NAVY, color: '#fff', borderRadius: 4, fontSize: 15, fontWeight: 800 }}>
                  <span>TOTAL</span><span>{money(voucher.amount)}</span>
                </div>
              </div>
            </div>
          )}

          {voucher.narration && (
            <div style={{ marginTop: 16, fontSize: 12, color: '#6B7280' }}><strong>Narration: </strong>{voucher.narration}</div>
          )}
          {voucher.reference && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}><strong>Reference: </strong>{voucher.reference}</div>
          )}
          {voucher.journalEntry?.entryNumber && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Posted as journal entry {voucher.journalEntry.entryNumber}</div>
          )}
        </div>

        {/* Footer band */}
        <div style={{ borderTop: `3px solid ${GOLD}`, padding: '12px 20px', textAlign: 'center', fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
          Thank you for doing business with {lh.companyName || companyName || 'us'}.
        </div>
      </div>

      {/* Source documents (not printed) */}
      <div className="no-print" style={{ marginTop: 16 }}>
        <VoucherAttachments
          voucherId={voucher._id}
          subdomain={settings?.subdomain}
          attachments={voucher.attachments || []}
          onChange={(atts) => setVoucher((v) => ({ ...v, attachments: atts }))}
          showToast={showToast}
        />
      </div>
    </div>
  );
}