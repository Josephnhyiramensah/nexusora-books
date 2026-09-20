// client/src/modules/vouchers/VoucherFormPage.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiArrowLeft, FiChevronDown, FiX } from 'react-icons/fi';
import voucherService from '../../services/voucherService';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import useIsMobile from '../../hooks/useIsMobile';
import VoucherLineItems from './VoucherLineItems';
import JournalVoucherLines from './JournalVoucherLines';

const VOUCHER_TYPES = [
  { value: 'payment',     label: 'Payment Voucher',  hint: 'Pay money out (e.g. expenses, suppliers)' },
  { value: 'receipt',     label: 'Receipt Voucher',  hint: 'Receive money in (e.g. from customers)' },
  { value: 'contra',      label: 'Contra Voucher',   hint: 'Move money between cash and bank' },
  { value: 'transfer',    label: 'Transfer Voucher', hint: 'Non-cash transfer between accounts' },
  { value: 'journal',     label: 'Journal Voucher',  hint: 'Non-cash adjustment (e.g. depreciation)' },
  { value: 'purchase',    label: 'Purchase Voucher', hint: 'Record a purchase' },
  { value: 'sales',       label: 'Sales Voucher',    hint: 'Record a sale' },
  { value: 'debit_note',  label: 'Debit Note',       hint: 'Reduce a payable / return to supplier' },
  { value: 'credit_note', label: 'Credit Note',      hint: 'Reduce a receivable / customer return' },
];

const MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'mobile_money',  label: 'Mobile Money (MoMo)' },
  { value: 'card',          label: 'Card' },
  { value: 'other',         label: 'Other' },
];

const MODE_FIELDS = {
  cash: [],
  bank_transfer: [
    { key: 'bank', label: 'Bank' }, { key: 'accountNo', label: 'Account No.' },
    { key: 'branch', label: 'Branch' }, { key: 'reference', label: 'Reference' },
  ],
  cheque: [
    { key: 'chequeNo', label: 'Cheque No.' }, { key: 'bank', label: 'Bank' }, { key: 'branch', label: 'Branch' },
  ],
  mobile_money: [
    { key: 'momoNumber', label: 'MoMo Number' }, { key: 'momoName', label: 'MoMo Name' }, { key: 'reference', label: 'Transaction Ref' },
  ],
  card: [ { key: 'cardLast4', label: 'Card (last 4)' }, { key: 'reference', label: 'Reference' } ],
  other: [ { key: 'reference', label: 'Reference' } ],
};

const CASH_SIDE = { receipt: 'debit', payment: 'credit', sales: 'debit', purchase: 'credit' };
const ITEMIZED_TYPES = ['sales', 'purchase'];

// A fresh pair of empty journal lines.
const emptyJvLines = () => ([
  { account: '', description: '', debit: '', credit: '' },
  { account: '', description: '', debit: '', credit: '' },
]);

// ── Searchable account dropdown ──────────────────────────────────────────────
function AccountSelect({ accounts, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const selected = accounts.find((a) => a._id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts.slice(0, 50);
    return accounts.filter((a) => `${a.code} ${a.name}`.toLowerCase().includes(q)).slice(0, 50);
  }, [query, accounts]);
  const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 14, boxSizing: 'border-box', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  return (
    <div ref={boxRef} style={{ position: 'relative', maxWidth: '100%' }}>
      <div style={input} onClick={() => { setOpen((o) => !o); setQuery(''); }}>
        <span style={{ color: selected ? 'inherit' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${selected.code} — ${selected.name}` : (placeholder || 'Select account…')}
        </span>
        {selected
          ? <FiX size={15} onClick={(e) => { e.stopPropagation(); onChange(''); }} style={{ flexShrink: 0, color: '#9CA3AF' }} />
          : <FiChevronDown size={15} style={{ flexShrink: 0, color: '#9CA3AF' }} />}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid var(--border, #D1D5DB)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type account code or name…" style={{ padding: '10px 12px', border: 'none', borderBottom: '1px solid #EEE', fontSize: 14, outline: 'none' }} />
          <div style={{ overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', color: '#9CA3AF', fontSize: 13 }}>No matching accounts</div>
            ) : filtered.map((a) => (
              <div key={a._id} onClick={() => { onChange(a._id); setOpen(false); }}
                style={{ padding: '10px 12px', fontSize: 14, cursor: 'pointer', background: a._id === value ? '#F2F6FC' : '#fff', wordBreak: 'break-word' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F7FAFF')}
                onMouseLeave={(e) => (e.currentTarget.style.background = a._id === value ? '#F2F6FC' : '#fff')}>
                <strong>{a.code}</strong> — {a.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoucherFormPage() {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    voucherType: 'payment',
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    narration: '', reference: '', partyName: '', terms: '',
    mode: 'cash',
    debitAccount: '', creditAccount: '', amount: '',
    paymentDetails: {},
    lineItems: [{ description: '', quantity: 1, unit: '', unitPrice: 0 }],
    discount: 0, isItemized: false,
    vatEnabled: false, vatRate: 15,
    lines: emptyJvLines(),   // journal-voucher lines (Account | Desc | Debit | Credit)
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/accounts');
        if (data.success) setAccounts(data.data.filter((a) => a.isActive !== false));
      } catch { showToast('Could not load accounts', 'error'); }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setDetail = (k, v) => setForm((f) => ({ ...f, paymentDetails: { ...f.paymentDetails, [k]: v } }));
  const setLines = (lines) => setForm((f) => ({ ...f, lines }));
  const setType = (t) => setForm((f) => ({
    ...f,
    voucherType: t,
    isItemized: ITEMIZED_TYPES.includes(t),
    ...(t === 'journal' ? { vatEnabled: false } : {}),
  }));

  const isJournal = form.voucherType === 'journal';
  const currentType = VOUCHER_TYPES.find((t) => t.value === form.voucherType);
  const modeFields = MODE_FIELDS[form.mode] || [];
  const acctLabel = (id) => { const a = accounts.find((x) => x._id === id); return a ? `${a.code} — ${a.name}` : ''; };

  // Totals: subtotal (items or amount) → discount → VAT → grand total.
  const itemsSubtotal = (form.lineItems || []).reduce((sm, it) => sm + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const baseAmount = form.isItemized ? itemsSubtotal : Number(form.amount) || 0;
  const afterDiscount = baseAmount - (form.isItemized ? (Number(form.discount) || 0) : 0);
  const vatAmount = form.vatEnabled ? Math.round(afterDiscount * ((Number(form.vatRate) || 0) / 100) * 100) / 100 : 0;
  const grandTotal = Math.round((afterDiscount + vatAmount) * 100) / 100;

  // Journal-voucher totals (independent of the single-entry amount above).
  const jvTotalDebit = (form.lines || []).reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const jvTotalCredit = (form.lines || []).reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const jvDiff = Math.round((jvTotalDebit - jvTotalCredit) * 100) / 100;
  const jvBalanced = jvDiff === 0 && jvTotalDebit > 0;

  // ── Save: journal voucher (multi-line, must balance) ───────────────────────
  const handleSaveJournal = async (thenPost) => {
    if (!form.date) { showToast('Please choose a date.', 'error'); return; }

    const cleanLines = (form.lines || [])
      .map((r) => ({
        account: r.account,
        description: (r.description || '').trim(),
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0,
      }))
      .filter((r) => r.account && (r.debit > 0 || r.credit > 0));

    if (cleanLines.length < 2) {
      showToast('A journal voucher needs at least two lines with an account and an amount.', 'error'); return;
    }
    if (cleanLines.some((r) => r.debit > 0 && r.credit > 0)) {
      showToast('Each line must be either a debit or a credit, not both.', 'error'); return;
    }
    const tD = Math.round(cleanLines.reduce((s, r) => s + r.debit, 0) * 100) / 100;
    const tC = Math.round(cleanLines.reduce((s, r) => s + r.credit, 0) * 100) / 100;
    if (tD <= 0) { showToast('Enter the debit and credit amounts.', 'error'); return; }
    if (tD !== tC) {
      showToast(`Journal must balance — debit ${money(tD)} vs credit ${money(tC)} (difference ${money(Math.abs(tD - tC))}).`, 'error'); return;
    }
    if (!form.narration || !form.narration.trim()) {
      showToast('Please enter a narration describing this journal entry.', 'error'); return;
    }

    setSaving(true);
    try {
      const result = await voucherService.create({
        voucherType: 'journal',
        date: form.date,
        dueDate: form.dueDate || undefined,
        narration: form.narration.trim(),
        reference: form.reference,
        terms: form.terms,
        lines: cleanLines,
        amount: tD,          // overall value of the JV (= total debit = total credit)
        isItemized: false,
        lineItems: [],
        discount: 0,
        vatEnabled: false, vatRate: 0,
      });
      if (!result.success) { showToast(result.message || 'Failed', 'error'); setSaving(false); return; }
      if (thenPost) {
        const posted = await voucherService.post(result.data._id);
        showToast(posted.success ? posted.message : (posted.message || 'Saved as draft (post failed)'), posted.success ? 'success' : 'error');
      } else { showToast(result.message, 'success'); }
      navigate('/vouchers');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save voucher', 'error');
    } finally { setSaving(false); }
  };

  // ── Save: single-entry vouchers (payment/receipt/…, itemized, VAT) ─────────
  const handleSave = async (thenPost) => {
    if (isJournal) return handleSaveJournal(thenPost);

    if (!form.date || !form.debitAccount || !form.creditAccount || !(grandTotal > 0)) {
      showToast('Fill in date, debit account, credit account and amount (or items).', 'error'); return;
    }
    if (form.debitAccount === form.creditAccount) { showToast('Debit and credit accounts must be different.', 'error'); return; }
    setSaving(true);
    try {
      const result = await voucherService.create({
        voucherType: form.voucherType, date: form.date, dueDate: form.dueDate || undefined,
        narration: form.narration, reference: form.reference, partyName: form.partyName, terms: form.terms,
        mode: form.mode, paymentDetails: form.paymentDetails,
        debitAccount: form.debitAccount, creditAccount: form.creditAccount,
        amount: grandTotal,   // VAT-inclusive grand total; backend splits VAT out
        isItemized: form.isItemized,
        lineItems: form.isItemized ? form.lineItems : [],
        discount: form.isItemized ? Number(form.discount) || 0 : 0,
        vatEnabled: form.vatEnabled, vatRate: form.vatEnabled ? Number(form.vatRate) || 0 : 0,
      });
      if (!result.success) { showToast(result.message || 'Failed', 'error'); setSaving(false); return; }
      if (thenPost) {
        const posted = await voucherService.post(result.data._id);
        showToast(posted.success ? posted.message : (posted.message || 'Saved as draft (post failed)'), posted.success ? 'success' : 'error');
      } else { showToast(result.message, 'success'); }
      navigate('/vouchers');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save voucher', 'error');
    } finally { setSaving(false); }
  };

  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6B7280)', marginBottom: 6 };
  const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 14, boxSizing: 'border-box' };
  const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 20, marginBottom: 16 };
  const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cashSide = CASH_SIDE[form.voucherType];
  const debitHint = cashSide === 'debit' ? 'Cash / bank (money in)' : 'What is received / owed';
  const creditHint = cashSide === 'credit' ? 'Cash / bank (money out)' : 'What is given / source';

  // The single-entry summary sidebar (right on desktop, bottom on mobile).
  const summary = (
    <div style={{ ...card, position: isMobile ? 'static' : 'sticky', top: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand, #3485E9)', margin: '0 0 12px', textTransform: 'uppercase' }}>Summary</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}><span style={{ color: '#6B7280' }}>{form.isItemized ? 'Items subtotal' : 'Amount'}</span><strong>{money(baseAmount)}</strong></div>
      {form.isItemized && (Number(form.discount) || 0) > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}><span style={{ color: '#6B7280' }}>Discount</span><span>−{money(form.discount)}</span></div>
      )}
      {form.vatEnabled && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}><span style={{ color: '#6B7280' }}>VAT ({form.vatRate}%)</span><span>{money(vatAmount)}</span></div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, padding: '10px 0', color: 'var(--deep-navy, #012158)', borderTop: '2px solid var(--border, #E5E7EB)', marginTop: 4 }}><span>Total</span><span>{money(grandTotal)}</span></div>

      {form.debitAccount && form.creditAccount && grandTotal > 0 && (
        <div style={{ marginTop: 14, padding: '12px', background: 'var(--surface-alt, #F2F6FC)', borderRadius: 8, fontSize: 13 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#6B7280', fontSize: 11, textTransform: 'uppercase' }}>Will post</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Dr {acctLabel(form.debitAccount).split(' — ')[0]}</span><span>{money(grandTotal)}</span></div>
          {form.vatEnabled && vatAmount > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Cr {acctLabel(form.creditAccount).split(' — ')[0]}</span><span>{money(grandTotal - vatAmount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Cr 2410 VAT</span><span>{money(vatAmount)}</span></div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Cr {acctLabel(form.creditAccount).split(' — ')[0]}</span><span>{money(grandTotal)}</span></div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        <button onClick={() => handleSave(true)} disabled={saving}
          style={{ padding: '12px', borderRadius: 8, border: 'none', background: 'var(--nexusora-gold, #FD9C09)', color: 'var(--deep-navy, #012158)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <FiSave size={15} /> {saving ? 'Saving…' : 'Save & Post'}
        </button>
        <button onClick={() => handleSave(false)} disabled={saving}
          style={{ padding: '11px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Save as Draft
        </button>
      </div>
    </div>
  );

  // The journal-voucher summary sidebar: totals + balance status.
  const jvSummary = (
    <div style={{ ...card, position: isMobile ? 'static' : 'sticky', top: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand, #3485E9)', margin: '0 0 12px', textTransform: 'uppercase' }}>Journal Summary</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}><span style={{ color: '#6B7280' }}>Total Debit</span><strong>{money(jvTotalDebit)}</strong></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}><span style={{ color: '#6B7280' }}>Total Credit</span><strong>{money(jvTotalCredit)}</strong></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, padding: '10px 0', borderTop: '2px solid var(--border, #E5E7EB)', marginTop: 4, color: jvBalanced ? '#065F46' : '#DC2626' }}>
        <span>{jvBalanced ? '✓ Balanced' : 'Difference'}</span>
        <span>{jvBalanced ? money(jvTotalDebit) : money(Math.abs(jvDiff))}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        <button onClick={() => handleSave(true)} disabled={saving || !jvBalanced}
          style={{ padding: '12px', borderRadius: 8, border: 'none', background: (saving || !jvBalanced) ? '#E5E7EB' : 'var(--nexusora-gold, #FD9C09)', color: (saving || !jvBalanced) ? '#9CA3AF' : 'var(--deep-navy, #012158)', fontWeight: 700, fontSize: 14, cursor: (saving || !jvBalanced) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <FiSave size={15} /> {saving ? 'Saving…' : 'Save & Post'}
        </button>
        <button onClick={() => handleSave(false)} disabled={saving || !jvBalanced}
          style={{ padding: '11px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', color: (saving || !jvBalanced) ? '#9CA3AF' : 'inherit', fontWeight: 600, fontSize: 14, cursor: (saving || !jvBalanced) ? 'not-allowed' : 'pointer' }}>
          Save as Draft
        </button>
        {!jvBalanced && (
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0', textAlign: 'center' }}>Debits and credits must balance before saving.</p>
        )}
      </div>
    </div>
  );

  // The main form column.
  const mainForm = (
    <div>
      <div style={card}>
        <label style={label}>Voucher Type</label>
        <select style={input} value={form.voucherType} onChange={(e) => setType(e.target.value)}>
          {VOUCHER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {currentType && <p style={{ fontSize: 12, color: 'var(--text-secondary, #6B7280)', marginTop: 8, marginBottom: 0 }}>{currentType.hint}</p>}
      </div>

      {isJournal ? (
        <>
          {/* Journal voucher: date + multi-line debit/credit table */}
          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div><label style={label}>Date</label><input type="date" style={input} value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ ...label, marginBottom: 10 }}>Journal Lines</label>
              <JournalVoucherLines
                lines={form.lines}
                accounts={accounts}
                onLinesChange={setLines}
                isMobile={isMobile}
              />
            </div>
          </div>

          {/* Journal voucher: narration / reference / terms (no party, no payment mode) */}
          <div style={card}>
            <div><label style={label}>Narration</label><input style={input} value={form.narration} onChange={(e) => set('narration', e.target.value)} placeholder="e.g. Being depreciation for September" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div><label style={label}>Reference (optional)</label><input style={input} value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="External reference no." /></div>
              <div><label style={label}>Terms / Notes (optional)</label><input style={input} value={form.terms} onChange={(e) => set('terms', e.target.value)} placeholder="Notes for print" /></div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div><label style={label}>Date</label><input type="date" style={input} value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
              <div><label style={label}>Due Date <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label><input type="date" style={input} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
            </div>
            {!form.isItemized && (
              <div style={{ marginTop: 16 }}>
                <label style={label}>Amount (GHS)</label>
                <input type="number" step="0.01" style={input} value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label style={label}>Debit Account <span style={{ fontWeight: 400, color: '#9CA3AF' }}>· {debitHint}</span></label>
                <AccountSelect accounts={accounts} value={form.debitAccount} onChange={(v) => set('debitAccount', v)} />
              </div>
              <div>
                <label style={label}>Credit Account <span style={{ fontWeight: 400, color: '#9CA3AF' }}>· {creditHint}</span></label>
                <AccountSelect accounts={accounts} value={form.creditAccount} onChange={(v) => set('creditAccount', v)} />
              </div>
            </div>
          </div>

          <div style={card}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: form.isItemized ? 14 : 0 }}>
              <input type="checkbox" checked={form.isItemized} onChange={(e) => set('isItemized', e.target.checked)} /> Itemized voucher (list items, quantities and prices)
            </label>
            {form.isItemized && (
              <VoucherLineItems
                items={form.lineItems} discount={form.discount}
                vatEnabled={form.vatEnabled} vatRate={form.vatRate}
                onItemsChange={(items) => set('lineItems', items)}
                onDiscountChange={(d) => set('discount', d)}
                onVatToggle={(v) => set('vatEnabled', v)}
                onVatRateChange={(r) => set('vatRate', r)}
                isMobile={isMobile}
              />
            )}
          </div>

          {/* VAT toggle for NON-itemized vouchers (itemized has it in the items totals) */}
          {!form.isItemized && (
            <div style={card}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.vatEnabled} onChange={(e) => set('vatEnabled', e.target.checked)} /> Apply VAT
              </label>
              {form.vatEnabled && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 13, color: '#6B7280' }}>VAT rate</label>
                  <input type="number" style={{ ...input, width: 100 }} value={form.vatRate} onChange={(e) => set('vatRate', e.target.value)} />
                  <span style={{ fontSize: 13, color: '#6B7280' }}>%  (the amount above is treated as VAT-inclusive)</span>
                </div>
              )}
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div><label style={label}>Party (payee / received from)</label><input style={input} value={form.partyName} onChange={(e) => set('partyName', e.target.value)} placeholder="e.g. ABC Ltd" /></div>
              <div>
                <label style={label}>Payment Mode</label>
                <select style={input} value={form.mode} onChange={(e) => set('mode', e.target.value)}>{MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
              </div>
            </div>
            {modeFields.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}>
                {modeFields.map((f) => (
                  <div key={f.key}><label style={label}>{f.label}</label><input style={input} value={form.paymentDetails[f.key] || ''} onChange={(e) => setDetail(f.key, e.target.value)} placeholder={f.label} /></div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16 }}><label style={label}>Narration</label><input style={input} value={form.narration} onChange={(e) => set('narration', e.target.value)} placeholder="What is this voucher for?" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div><label style={label}>Reference (optional)</label><input style={input} value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="External reference no." /></div>
              <div><label style={label}>Terms / Notes (optional)</label><input style={input} value={form.terms} onChange={(e) => set('terms', e.target.value)} placeholder="Terms, conditions or notes for print" /></div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const activeSummary = isJournal ? jvSummary : summary;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {ToastComponent}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/vouchers')} style={{ ...input, width: 'auto', padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent' }}>
          <FiArrowLeft size={15} /> Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>New Voucher</h1>
      </div>

      {isMobile ? (
        <div>{mainForm}{activeSummary}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {mainForm}
          {activeSummary}
        </div>
      )}
    </div>
  );
}