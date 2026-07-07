// client/src/modules/accounts/AccountForm.jsx

import { useState, useEffect } from 'react';

const accountTypes = [
  { value: 'asset', label: 'Asset', normalBalance: 'debit' },
  { value: 'liability', label: 'Liability', normalBalance: 'credit' },
  { value: 'equity', label: 'Equity', normalBalance: 'credit' },
  { value: 'revenue', label: 'Revenue', normalBalance: 'credit' },
  { value: 'cogs', label: 'Cost of Goods Sold', normalBalance: 'debit' },
  { value: 'expense', label: 'Expense', normalBalance: 'debit' },
];

const categories = {
  asset: ['Current Asset', 'Non-Current Asset'],
  liability: ['Current Liability', 'Non-Current Liability'],
  equity: ['Equity'],
  revenue: ['Operating Revenue', 'Other Income'],
  cogs: ['Cost of Goods Sold'],
  expense: ['Operating Expense'],
};

const codeRanges = {
  asset: '1000–1999', liability: '2000–2999', equity: '3000–3999',
  revenue: '4000–4999', cogs: '5000–5999', expense: '6000–6999',
};

export default function AccountForm({ account, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: account?.code || '',
    name: account?.name || '',
    type: account?.type || 'asset',
    category: account?.category || '',
    parentCode: account?.parentCode || '',
    description: account?.description || '',
    normalBalance: account?.normalBalance || 'debit',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const isEditing = !!account;

  // Validate in real time
  useEffect(() => {
    const newErrors = {};

    if (touched.code) {
      if (!form.code) newErrors.code = 'Account code is required';
      else if (!/^\d{4}$/.test(form.code)) newErrors.code = 'Code must be exactly 4 digits';
      else {
        // Check if code matches the type range
        const num = parseInt(form.code);
        const ranges = { asset: [1000, 1999], liability: [2000, 2999], equity: [3000, 3999], revenue: [4000, 4999], cogs: [5000, 5999], expense: [6000, 6999] };
        const range = ranges[form.type];
        if (range && (num < range[0] || num > range[1])) {
          newErrors.code = `${form.type} codes should be ${range[0]}–${range[1]}`;
        }
      }
    }

    if (touched.name && !form.name) newErrors.name = 'Account name is required';

    setErrors(newErrors);
  }, [form, touched]);

  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleChange = (field, value) => {
    const updated = { ...form, [field]: value };

    // Auto-set normal balance and category when type changes
    if (field === 'type') {
      const typeInfo = accountTypes.find((t) => t.value === value);
      updated.normalBalance = typeInfo?.normalBalance || 'debit';
      updated.category = '';
    }

    // Auto-suggest type from code
    if (field === 'code' && value.length >= 1) {
      const firstDigit = value[0];
      const autoType = { '1': 'asset', '2': 'liability', '3': 'equity', '4': 'revenue', '5': 'cogs', '6': 'expense' };
      if (autoType[firstDigit] && !isEditing) {
        updated.type = autoType[firstDigit];
        const typeInfo = accountTypes.find((t) => t.value === autoType[firstDigit]);
        updated.normalBalance = typeInfo?.normalBalance || 'debit';
      }
    }

    setForm(updated);
    markTouched(field);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mark all as touched
    setTouched({ code: true, name: true, type: true });
    if (!form.code || !form.name) return;
    onSave(form);
  };

  const inputStyle = (field) => ({
    width: '100%', padding: '10px 14px',
    border: `1px solid ${errors[field] ? 'var(--danger)' : 'var(--border)'}`,
    borderBottom: errors[field] ? '2px solid var(--danger)' : undefined,
    borderRadius: 'var(--radius-sm)', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color var(--transition-fast)',
  });

  const labelStyle = (field) => ({
    display: 'block', fontSize: 13, fontWeight: 500,
    color: errors[field] ? 'var(--danger)' : 'var(--text-secondary)',
    marginBottom: 6,
  });

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle('code')}>Account Code *</label>
          <input
            style={inputStyle('code')} value={form.code}
            onChange={(e) => handleChange('code', e.target.value)}
            onBlur={() => markTouched('code')}
            placeholder="e.g. 1050" required disabled={isEditing && account?.isSystemAccount}
            maxLength={4}
            onFocus={(e) => { if (!errors.code) e.target.style.borderColor = 'var(--tech-blue)'; }}
          />
          {errors.code
            ? <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.code}</p>
            : <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {form.type ? `${accountTypes.find(t => t.value === form.type)?.label} range: ${codeRanges[form.type]}` : 'Enter a 4-digit code'}
              </p>
          }
        </div>
        <div>
          <label style={labelStyle('type')}>Account Type *</label>
          <select
            style={inputStyle('type')} value={form.type}
            onChange={(e) => handleChange('type', e.target.value)}
            disabled={isEditing && account?.isSystemAccount}
          >
            {accountTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Normal balance: <strong style={{ textTransform: 'capitalize' }}>{form.normalBalance}</strong> (auto-set)
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle('name')}>Account Name *</label>
        <input
          style={inputStyle('name')} value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => markTouched('name')}
          placeholder="e.g. Prepaid Rent" required
          onFocus={(e) => { if (!errors.name) e.target.style.borderColor = 'var(--tech-blue)'; }}
        />
        {errors.name && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.name}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle()}>Category</label>
          <select style={inputStyle()} value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}>
            <option value="">Select category</option>
            {(categories[form.type] || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>Parent Code (optional)</label>
          <input style={inputStyle()} value={form.parentCode}
            onChange={(e) => handleChange('parentCode', e.target.value)}
            placeholder="e.g. 1400 for sub-accounts"
          />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle()}>Description</label>
        <textarea
          style={{ ...inputStyle(), minHeight: 70, resize: 'vertical' }}
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Brief description of this account..."
        />
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{
          padding: '10px 22px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff',
        }}>Cancel</button>
        <button type="submit" style={{
          padding: '10px 22px', borderRadius: 'var(--radius-sm)',
          background: 'var(--nexusora-gold)', color: 'var(--deep-navy)',
          fontSize: 14, fontWeight: 600,
          opacity: (errors.code || errors.name) ? 0.6 : 1,
        }}>{isEditing ? 'Update' : 'Create'} Account</button>
      </div>
    </form>
  );
}