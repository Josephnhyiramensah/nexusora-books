// client/src/utils/formatters.js
// Currency, date, and number formatting helpers

/**
 * Format a number as currency (GHS default).
 */
export function formatCurrency(amount, currency = 'GHS') {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

/**
 * Format a date to DD/MM/YYYY.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a date for HTML input (YYYY-MM-DD).
 */
export function toInputDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toISOString().split('T')[0];
}

/**
 * Status badge colour mapping.
 */
export function getStatusColor(status) {
  const map = {
    draft: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    posted: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
    reversed: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
    active: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
    inactive: { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
    sent: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
    partially_paid: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    paid: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
    overdue: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
    cancelled: { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
    approved: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  };
  return map[status] || { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
}