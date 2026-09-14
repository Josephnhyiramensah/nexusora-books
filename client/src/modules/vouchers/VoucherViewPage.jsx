// client/src/modules/vouchers/VoucherViewPage.jsx
// Read-only view of a single voucher: full details, the journal entry it created,
// and its attached source documents (upload/view/remove). This is what an auditor
// opens to inspect a voucher and its supporting scans.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiCornerDownLeft } from 'react-icons/fi';
import voucherService from '../../services/voucherService';
import VoucherAttachments from './VoucherAttachments';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

const TYPE_LABELS = {
  payment: 'Payment', receipt: 'Receipt', contra: 'Contra', transfer: 'Transfer',
  journal: 'Journal', purchase: 'Purchase', sales: 'Sales',
  debit_note: 'Debit Note', credit_note: 'Credit Note',
};
const MODE_LABELS = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
  mobile_money: 'Mobile Money', card: 'Card', other: 'Other',
};
const statusStyle = (s) => ({
  draft: { bg: '#FEF3C7', color: '#92400E', label: 'Draft' },
  awaiting_approval: { bg: '#DBEAFE', color: '#1E40AF', label: 'Awaiting Approval' },
  posted: { bg: '#D1FAE5', color: '#065F46', label: 'Posted' },
  reversed: { bg: '#FEE2E2', color: '#991B1B', label: 'Reversed' },
}[s] || { bg: '#EEE', color: '#333', label: s });

export default function VoucherViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subdomain } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const { user } = useAuth();
  const canReverse = ['super_admin', 'admin'].includes(user?.role);

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

  if (loading) return <p style={{ padding: 40, color: 'var(--text-muted, #9CA3AF)' }}>Loading voucher…</p>;
  if (!voucher) return <p style={{ padding: 40, color: 'var(--text-muted, #9CA3AF)' }}>Voucher not found.</p>;

  const s = statusStyle(voucher.status);
  const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 24, marginBottom: 16 };
  const row = { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F5F5F5', fontSize: 14 };
  const lbl = { color: 'var(--text-secondary, #6B7280)' };
  const val = { fontWeight: 600, color: 'var(--text-primary, #111827)', textAlign: 'right' };
  const ghost = { padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {ToastComponent}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/vouchers')} style={ghost}><FiArrowLeft size={14} /> Back</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>{voucher.voucherNumber}</h1>
          <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {voucher.status === 'draft' && <button onClick={handlePost} style={{ ...ghost, color: '#065F46', borderColor: '#065F46' }}><FiCheckCircle size={14} /> Post</button>}
          {voucher.status === 'posted' && canReverse && <button onClick={handleReverse} style={{ ...ghost, color: '#B45309', borderColor: '#B45309' }}><FiCornerDownLeft size={14} /> Reverse</button>}
        </div>
      </div>

      <div style={card}>
        <div style={row}><span style={lbl}>Type</span><span style={val}>{TYPE_LABELS[voucher.voucherType] || voucher.voucherType} Voucher</span></div>
        <div style={row}><span style={lbl}>Date</span><span style={val}>{formatDate(voucher.date)}</span></div>
        <div style={row}><span style={lbl}>Amount</span><span style={val}>{formatCurrency(voucher.amount)}</span></div>
        <div style={row}><span style={lbl}>Party</span><span style={val}>{voucher.partyName || '—'}</span></div>
        <div style={row}><span style={lbl}>Payment Mode</span><span style={val}>{MODE_LABELS[voucher.mode] || voucher.mode}</span></div>
        {voucher.reference && <div style={row}><span style={lbl}>Reference</span><span style={val}>{voucher.reference}</span></div>}
        {voucher.narration && <div style={{ ...row, borderBottom: 'none' }}><span style={lbl}>Narration</span><span style={{ ...val, maxWidth: '60%' }}>{voucher.narration}</span></div>}
      </div>

      {/* The accounting lines */}
      <div style={card}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand, #3485E9)', margin: '0 0 12px', textTransform: 'uppercase' }}>Accounting</p>
        {(voucher.lines || []).map((l, i) => (
          <div key={i} style={row}>
            <span style={lbl}>{l.accountCode} · {l.accountName}</span>
            <span style={val}>{l.debit > 0 ? `Dr ${formatCurrency(l.debit)}` : `Cr ${formatCurrency(l.credit)}`}</span>
          </div>
        ))}
        {voucher.journalEntry?.entryNumber && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>Posted as journal entry {voucher.journalEntry.entryNumber}</div>
        )}
      </div>

      {/* Source documents */}
      <VoucherAttachments
        voucherId={voucher._id}
        subdomain={subdomain}
        attachments={voucher.attachments || []}
        onChange={(atts) => setVoucher((v) => ({ ...v, attachments: atts }))}
        showToast={showToast}
      />
    </div>
  );
}
