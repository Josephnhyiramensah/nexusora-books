// client/src/modules/journals/JournalFormPage.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSave, FiSend, FiAlertCircle } from 'react-icons/fi';
import accountService from '../../services/accountService';
import journalService from '../../services/journalService';
import { useToast } from '../../hooks/useToast';
import SmartAccountSelect from '../../components/common/SmartAccountSelect';

const emptyLine = () => ({ account: '', accountData: null, debit: '', credit: '', description: '' });

export default function JournalFormPage() {
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();
  const lastLineRef = useRef(null);

  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    journalType: 'general',
    description: '',
    reference: '',
    lines: [emptyLine()],
  });
// , emptyLine()
  useEffect(() => {
    accountService.getAll({ isActive: 'true' }).then((res) => {
      if (res.success) setAccounts(res.data);
    }).catch(() => {});
  }, []);

  // Calculate totals
  const totalDebit = form.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = difference === 0 && totalDebit > 0;

  // Real-time validation
  useEffect(() => {
    const newErrors = {};

    if (touched.date && !form.date) newErrors.date = 'Date is required';
    if (touched.description && !form.description) newErrors.description = 'Description recommended';

    form.lines.forEach((line, i) => {
      if (line.account || line.debit || line.credit) {
        if (!line.account) newErrors[`line_${i}_account`] = 'Select an account';
        if (!line.debit && !line.credit) newErrors[`line_${i}_amount`] = 'Enter debit or credit';
        if (line.debit && line.credit) newErrors[`line_${i}_both`] = 'Cannot have both debit and credit';

        // Check for duplicate accounts
        const duplicates = form.lines.filter((l, j) => j !== i && l.account && l.account === line.account);
        if (duplicates.length > 0) newErrors[`line_${i}_dup`] = 'Duplicate account';
      }
    });

    setErrors(newErrors);
  }, [form, touched]);

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const updateLine = (index, field, value, accountData = null) => {
    const updated = [...form.lines];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'account' && accountData) {
      updated[index].accountData = accountData;
    }

    // If entering debit, clear credit and vice versa
    if (field === 'debit' && value) updated[index].credit = '';
    if (field === 'credit' && value) updated[index].debit = '';

    setForm({ ...form, lines: updated });
    markTouched(`line_${index}_${field}`);
  };

  const addLine = () => {
    setForm({ ...form, lines: [...form.lines, emptyLine()] });
    // Focus the new line after render
    setTimeout(() => {
      lastLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // const removeLine = (index) => {
  //   if (form.lines.length <= 2) return;

    const removeLine = (index) => {
    if (form.lines.length <= 1) return;

    
    const updated = form.lines.filter((_, i) => i !== index);
    setForm({ ...form, lines: updated });
  };

  // Quick-balance: auto-fill last empty line to balance
  const autoBalance = () => {
    if (isBalanced) return;

    const lastEmptyIdx = form.lines.findLastIndex(
      (l) => l.account && !l.debit && !l.credit
    );
    if (lastEmptyIdx === -1) return;

    const updated = [...form.lines];
    if (totalDebit > totalCredit) {
      updated[lastEmptyIdx].credit = (totalDebit - totalCredit).toFixed(2);
      updated[lastEmptyIdx].debit = '';
    } else {
      updated[lastEmptyIdx].debit = (totalCredit - totalDebit).toFixed(2);
      updated[lastEmptyIdx].credit = '';
    }
    setForm({ ...form, lines: updated });
  };

  const handleSave = async (postAfterSave = false) => {
    // Mark all fields touched
    setTouched({ date: true, description: true });
    form.lines.forEach((_, i) => {
      markTouched(`line_${i}_account`);
      markTouched(`line_${i}_amount`);
    });

    const validLines = form.lines.filter((l) => l.account && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));

    if (!form.date) {
      showToast('Please select a date.', 'error');
      return;
    }
    if (validLines.length < 2) {
      showToast('At least 2 lines with accounts and amounts are required.', 'error');
      return;
    }
    if (!isBalanced) {
      showToast(`Total Debits must equal Credits. Difference: ${Math.abs(difference).toFixed(2)}`, 'error');
      return;
    }

    const entryData = {
      date: form.date,
      journalType: form.journalType,
      description: form.description,
      reference: form.reference,
      lines: validLines.map((l) => ({
        account: l.account,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description,
      })),
    };

    try {
      setSaving(true);
      const result = await journalService.create(entryData);
      if (result.success) {
        if (postAfterSave) {
          const postResult = await journalService.post(result.data._id);
          if (postResult.success) {
            showToast(`${result.data.entryNumber} created and posted!`);
          }
        } else {
          showToast(`${result.data.entryNumber} saved as draft.`);
        }
        navigate('/journals');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = (hasError = false, focused = false) => ({
    width: '100%', padding: '8px 12px',
    border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
    borderBottom: hasError ? '2px solid var(--danger)' : undefined,
    borderRadius: 'var(--radius-sm)', fontSize: 13,
    color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color var(--transition-fast)',
  });

  const headerInputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    fontSize: 13, color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color var(--transition-fast)',
  };

  return (
    <div>
      {ToastComponent}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>
          New Journal Entry
        </h1>
        {/* Quick balance button */}
        {!isBalanced && totalDebit > 0 && (
          <button onClick={autoBalance} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--tech-blue)', color: 'var(--tech-blue)',
            fontSize: 12, fontWeight: 600, background: '#fff',
          }}>
            Auto-Balance Last Line
          </button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 28 }}>

        {/* Header Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: errors.date ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: 6 }}>
              Date <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input type="date" value={form.date}
              onChange={(e) => { setForm({ ...form, date: e.target.value }); markTouched('date'); }}
              style={{
                ...headerInputStyle,
                borderColor: errors.date ? 'var(--danger)' : undefined,
                borderBottom: errors.date ? '2px solid var(--danger)' : undefined,
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; markTouched('date'); }}
            />
            {errors.date && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.date}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Journal Type <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select value={form.journalType} onChange={(e) => setForm({ ...form, journalType: e.target.value })} style={headerInputStyle}>
              <option value="general">General Journal</option>
              <option value="sales">Sales Journal</option>
              <option value="purchases">Purchases Journal</option>
              <option value="cash_receipts">Cash Receipts Journal</option>
              <option value="cash_payments">Cash Payments Journal</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Reference</label>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="INV-001, CHQ-102..." style={headerInputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: errors.description === 'Description recommended' ? 'var(--warning)' : 'var(--text-secondary)', marginBottom: 6 }}>
              Description
            </label>
            <input value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onBlur={() => markTouched('description')}
              placeholder="What is this entry for?" style={headerInputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
            />
            {touched.description && !form.description && (
              <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>Recommended for audit trail</p>
            )}
          </div>
        </div>

        {/* Journal Lines Table */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--deep-navy)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '4%' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '33%' }}>Account</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', width: '20%' }}>Description</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '17%' }}>Debit (GHS)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#fff', width: '17%' }}>Credit (GHS)</th>
                <th style={{ width: '9%' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, i) => {
                const lineHasError = errors[`line_${i}_account`] || errors[`line_${i}_amount`] || errors[`line_${i}_both`] || errors[`line_${i}_dup`];
                const lineError = errors[`line_${i}_both`] || errors[`line_${i}_dup`] || errors[`line_${i}_account`] || errors[`line_${i}_amount`];

                return (
                  <tr key={i} ref={i === form.lines.length - 1 ? lastLineRef : null}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: lineHasError ? '#FFF5F5' : i % 2 === 0 ? '#fff' : '#FAFBFC',
                    }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <SmartAccountSelect
                        accounts={accounts}
                        value={line.account}
                        onChange={(accountId, accountData) => updateLine(i, 'account', accountId, accountData)}
                        placeholder="Type code or name..."
                      />
                      {line.accountData && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                          <span>Type: <strong style={{ textTransform: 'capitalize' }}>{line.accountData.type}</strong></span>
                          <span>Normal: <strong style={{ textTransform: 'capitalize' }}>{line.accountData.normalBalance}</strong></span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(i, 'description', e.target.value)}
                        placeholder="Line memo"
                        style={{ ...inputStyle(), fontSize: 12 }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number" step="0.01" min="0"
                        value={line.debit}
                        onChange={(e) => updateLine(i, 'debit', e.target.value)}
                        placeholder="0.00"
                        style={{
                          ...inputStyle(!!errors[`line_${i}_both`]),
                          textAlign: 'right', fontSize: 12, fontFamily: 'monospace',
                          fontWeight: line.debit ? 600 : 400,
                          background: line.debit ? '#F0FFF4' : undefined,
                        }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number" step="0.01" min="0"
                        value={line.credit}
                        onChange={(e) => updateLine(i, 'credit', e.target.value)}
                        placeholder="0.00"
                        style={{
                          ...inputStyle(!!errors[`line_${i}_both`]),
                          textAlign: 'right', fontSize: 12, fontFamily: 'monospace',
                          fontWeight: line.credit ? 600 : 400,
                          background: line.credit ? '#FFF5F5' : undefined,
                        }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeLine(i)}
                        disabled={form.lines.length <= 2}
                        title={form.lines.length <= 2 ? 'Minimum 2 lines' : 'Remove line'}
                        style={{
                          padding: 6,
                          color: form.lines.length <= 2 ? 'var(--border)' : 'var(--danger)',
                          cursor: form.lines.length <= 2 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals Footer */}
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--deep-navy)', background: '#F8FAFC' }}>
                <td colSpan={3} style={{ padding: '14px 12px' }}>
                  <button onClick={addLine} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px', borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--tech-blue)', color: 'var(--tech-blue)',
                    fontSize: 12, fontWeight: 600, background: '#fff',
                    transition: 'all var(--transition-fast)',
                  }}>
                    <FiPlus size={14} /> Add Line
                  </button>
                </td>
                <td style={{
                  padding: '14px 12px', textAlign: 'right', fontWeight: 700,
                  fontFamily: 'monospace', fontSize: 15, color: 'var(--deep-navy)',
                }}>
                  {totalDebit.toFixed(2)}
                </td>
                <td style={{
                  padding: '14px 12px', textAlign: 'right', fontWeight: 700,
                  fontFamily: 'monospace', fontSize: 15, color: 'var(--deep-navy)',
                }}>
                  {totalCredit.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Balance Indicator */}
        <div style={{
          padding: '14px 20px', borderRadius: 'var(--radius-sm)', marginBottom: 24,
          background: isBalanced ? '#D1FAE5' : difference !== 0 ? '#FEE2E2' : '#F3F4F6',
          color: isBalanced ? '#065F46' : difference !== 0 ? '#991B1B' : '#6B7280',
          fontSize: 13, fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isBalanced && difference !== 0 && <FiAlertCircle size={16} />}
            {isBalanced ? '✓ Balanced — Ready to save' :
              totalDebit === 0 && totalCredit === 0 ? 'Enter amounts to begin' :
              `✗ Out of balance by ${Math.abs(difference).toFixed(2)}`}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 14 }}>
            Diff: {difference.toFixed(2)}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={() => navigate('/journals')} style={{
            padding: '11px 24px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', fontSize: 14,
            color: 'var(--text-secondary)', background: '#fff',
          }}>Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving || !isBalanced} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 'var(--radius-sm)',
            background: isBalanced ? 'var(--tech-blue)' : 'var(--border)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: saving || !isBalanced ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
            <FiSave size={15} /> {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving || !isBalanced} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 'var(--radius-sm)',
            background: isBalanced ? 'var(--nexusora-gold)' : 'var(--border)',
            color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600,
            cursor: saving || !isBalanced ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
            <FiSend size={15} /> {saving ? 'Posting...' : 'Save & Post'}
          </button>
        </div>
      </div>
    </div>
  );
}