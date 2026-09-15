// client/src/modules/vouchers/VoucherActionsMenu.jsx
// Dropdown actions menu for a voucher row: View, Print, Post, Reverse, Delete.
// Actions shown depend on the voucher's status and the user's role.
import { useState, useRef, useEffect } from 'react';
import { FiMoreVertical, FiEye, FiPrinter, FiCheckCircle, FiCornerDownLeft, FiTrash2 } from 'react-icons/fi';

export default function VoucherActionsMenu({ voucher, canReverse, onView, onPrint, onPost, onReverse, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const item = (icon, label, action, color) => (
    <button
      onClick={() => { setOpen(false); action(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', fontSize: 13, color: color || 'var(--text-primary, #111827)', cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F7FAFF')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon} {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Actions"
        style={{ padding: 7, borderRadius: 8, border: '1px solid var(--border, #E5E7EB)', background: 'transparent', cursor: 'pointer', display: 'inline-flex' }}
      >
        <FiMoreVertical size={16} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 40, background: '#fff', border: '1px solid var(--border, #E5E7EB)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: 170, overflow: 'hidden', padding: '4px 0' }}>
          {item(<FiEye size={15} />, 'View', onView)}
          {item(<FiPrinter size={15} />, 'Print', onPrint)}
          {voucher.status === 'draft' && item(<FiCheckCircle size={15} />, 'Post', onPost, '#065F46')}
          {voucher.status === 'posted' && canReverse && item(<FiCornerDownLeft size={15} />, 'Reverse', onReverse, '#B45309')}
          {voucher.status === 'draft' && item(<FiTrash2 size={15} />, 'Delete', onDelete, '#DC2626')}
        </div>
      )}
    </div>
  );
}
