// client/src/components/common/SmartInput.jsx
// Input with validation, error underline, and inline hints

import { useState } from 'react';

export default function SmartInput({
  value, onChange, type = 'text', placeholder,
  required = false, validate, errorMessage,
  label, hint, style: customStyle = {},
  ...props
}) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  // Determine error state
  let hasError = false;
  let displayError = '';

  if (touched && !focused) {
    if (required && (!value || value === '')) {
      hasError = true;
      displayError = `${label || 'This field'} is required`;
    } else if (validate && value) {
      const validationResult = validate(value);
      if (validationResult !== true) {
        hasError = true;
        displayError = validationResult || errorMessage || 'Invalid value';
      }
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 12, fontWeight: 600,
          color: hasError ? 'var(--danger)' : 'var(--text-secondary)',
          marginBottom: 6, transition: 'color var(--transition-fast)',
        }}>{label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setTouched(true); setFocused(false); }}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px',
          border: `1px solid ${hasError ? 'var(--danger)' : focused ? 'var(--tech-blue)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)', fontSize: 13,
          color: 'var(--text-primary)', outline: 'none',
          transition: 'border-color var(--transition-fast)',
          borderBottom: hasError ? '2px solid var(--danger)' : undefined,
          ...customStyle,
        }}
        {...props}
      />
      {/* Error message */}
      {hasError && displayError && (
        <p style={{
          fontSize: 11, color: 'var(--danger)', marginTop: 4, fontWeight: 500,
          animation: 'fadeIn 150ms ease',
        }}>
          {displayError}
        </p>
      )}
      {/* Hint */}
      {hint && !hasError && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}