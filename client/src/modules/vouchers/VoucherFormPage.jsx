// client/src/modules/vouchers/VoucherFormPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import voucherService from '../../services/voucherService';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';

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
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export default function VoucherFormPage() {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    voucherType: 'payment',
    date: new Date().toISOString().slice(0, 10),
    narration: '',
    reference: '',
    partyName: '',
    mode: 'cash',
    bankName: '',
    instrumentNo: '',
    debitAccount: '',
    creditAccount: '',
    amount: '',
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
  const acctLabel = (id) => {
    const a = accounts.find((x) => x._id === id);
    return a ? `${a.code} — ${a.name}` : '';
  };

  const currentType = VOUCHER_TYPES.find((t) => t.value === form.voucherType);

  const handleSave = async (thenPost) => {
    if (!form.date || !form.debitAccount || !form.creditAccount || !form.amount) {
      showToast('Fill in date, debit account, credit account and amount.', 'error');
      return;
    }
    if (form.debitAccount === form.creditAccount) {
      showToast('Debit and credit accounts must be different.', 'error');
      return;
    }
    if (Number(form.amount) <= 0) {
      showToast('Amount must be greater than zero.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await voucherService.create({
        voucherType: form.voucherType,
        date: form.date,
        narration: form.narration,
        reference: form.reference,
        partyName: form.partyName,
        mode: form.mode,
        bankName: form.bankName,
        instrumentNo: form.instrumentNo,
        debitAccount: form.debitAccount,
        creditAccount: form.creditAccount,
        amount: Number(form.amount),
      });
      if (!result.success) { showToast(result.message || 'Failed', 'error'); setSaving(false); return; }

      if (thenPost) {
        const posted = await voucherService.post(result.data._id);
        showToast(posted.success ? posted.message : (posted.message || 'Saved as draft (post failed)'), posted.success ? 'success' : 'error');
      } else {
        showToast(result.message, 'success');
      }
      navigate('/vouchers');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save voucher', 'error');
    } finally {
      setSaving(false);
    }
  };

  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6B7280)', marginBottom: 6 };
  const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', fontSize: 14, boxSizing: 'border-box' };
  const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 20, marginBottom: 16 };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {ToastComponent}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/vouchers')} style={{ ...input, width: 'auto', padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent' }}>
          <FiArrowLeft size={15} /> Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0 }}>New Voucher</h1>
      </div>

      <div style={card}>
        <label style={label}>Voucher Type</label>
        <select style={input} value={form.voucherType} onChange={(e) => set('voucherType', e.target.value)}>
          {VOUCHER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {currentType && <p style={{ fontSize: 12, color: 'var(--text-secondary, #6B7280)', marginTop: 8, marginBottom: 0 }}>{currentType.hint}</p>}
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Date</label>
            <input type="date" style={input} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label style={label}>Amount (GHS)</label>
            <input type="number" step="0.01" style={input} value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div>
            <label style={label}>Debit Account (what is received / owed)</label>
            <select style={input} value={form.debitAccount} onChange={(e) => set('debitAccount', e.target.value)}>
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Credit Account (what is given / source)</label>
            <select style={input} value={form.creditAccount} onChange={(e) => set('creditAccount', e.target.value)}>
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Party (payee / received from)</label>
            <input style={input} value={form.partyName} onChange={(e) => set('partyName', e.target.value)} placeholder="e.g. ABC Ltd" />
          </div>
          <div>
            <label style={label}>Payment Mode</label>
            <select style={input} value={form.mode} onChange={(e) => set('mode', e.target.value)}>
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        {form.mode !== 'cash' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <label style={label}>Bank</label>
              <input style={input} value={form.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="Bank name" />
            </div>
            <div>
              <label style={label}>Instrument / Cheque No.</label>
              <input style={input} value={form.instrumentNo} onChange={(e) => set('instrumentNo', e.target.value)} placeholder="Optional" />
            </div>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <label style={label}>Narration</label>
          <input style={input} value={form.narration} onChange={(e) => set('narration', e.target.value)} placeholder="What is this voucher for?" />
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={label}>Reference (optional)</label>
          <input style={input} value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="External reference no." />
        </div>
      </div>

      {form.debitAccount && form.creditAccount && form.amount > 0 && (
        <div style={{ ...card, background: 'var(--surface-alt, #F2F6FC)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand, #3485E9)', margin: '0 0 10px', textTransform: 'uppercase' }}>Accounting preview</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span>Debit: {acctLabel(form.debitAccount)}</span>
            <strong>{formatCurrency(Number(form.amount))}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span>Credit: {acctLabel(form.creditAccount)}</span>
            <strong>{formatCurrency(Number(form.amount))}</strong>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => handleSave(false)} disabled={saving}
          style={{ padding: '11px 22px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Save as Draft
        </button>
        <button onClick={() => handleSave(true)} disabled={saving}
          style={{ padding: '11px 22px', borderRadius: 8, border: 'none', background: 'var(--nexusora-gold, #FD9C09)', color: 'var(--deep-navy, #012158)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <FiSave size={15} /> {saving ? 'Saving…' : 'Save & Post'}
        </button>
      </div>
    </div>
  );
}