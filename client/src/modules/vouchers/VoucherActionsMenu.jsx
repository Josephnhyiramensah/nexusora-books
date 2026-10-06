// client/src/modules/vouchers/VoucherActionsMenu.jsx
// Dropdown actions menu for a voucher row: View, Print, Post, Reverse, Delete.
// Actions shown depend on the voucher's status and the user's role.
// The menu auto-flips: it opens downward when there is room below the button,
// and upward when the button is near the bottom of the viewport (so it is never
// clipped off-screen on the lower rows).
import { useState, useRef, useEffect } from 'react';
import { FiMoreVertical, FiEye, FiPrinter, FiEdit2, FiCheckCircle, FiCornerDownLeft, FiTrash2 } from 'react-icons/fi';

export default function VoucherActionsMenu({ voucher, canReverse, canApprove, onView, onPrint, onEdit, onPost, onApprove, onReject, onReverse, onDelete }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // How many rows this menu will show, so we can estimate its height.
  const itemCount =
    2 + // View + Print always
    (voucher.status === 'draft' ? 3 : 0) + // Edit + Post + Delete
    (voucher.status === 'awaiting_approval' && canApprove ? 2 : 0) + // Approve + Reject
    (voucher.status === 'posted' && canReverse ? 1 : 0); // Reverse
  const estMenuHeight = itemCount * 38 + 8; // ~38px per item + padding

  // Decide direction at the moment of opening, from the button's live position.
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        const spaceAbove = r.top;
        // Flip up only when there isn't room below AND there is more room above.
        setDropUp(spaceBelow < estMenuHeight + 12 && spaceAbove > spaceBelow);
      }
      return next;
    });
  };

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
        ref={triggerRef}
        onClick={toggle}
        title="Actions"
        style={{ padding: 7, borderRadius: 8, border: '1px solid var(--border, #E5E7EB)', background: 'transparent', cursor: 'pointer', display: 'inline-flex' }}
      >
        <FiMoreVertical size={16} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, [dropUp ? 'bottom' : 'top']: '110%', zIndex: 40, background: '#fff', border: '1px solid var(--border, #E5E7EB)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: 170, overflow: 'hidden', padding: '4px 0' }}>
          {item(<FiEye size={15} />, 'View', onView)}
          {item(<FiPrinter size={15} />, 'Print', onPrint)}
          {voucher.status === 'draft' && onEdit && item(<FiEdit2 size={15} />, 'Edit', onEdit, '#1E40AF')}
          {voucher.status === 'draft' && item(<FiCheckCircle size={15} />, 'Post', onPost, '#065F46')}
          {voucher.status === 'awaiting_approval' && canApprove && item(<FiCheckCircle size={15} />, 'Approve', onApprove, '#065F46')}
          {voucher.status === 'awaiting_approval' && canApprove && item(<FiTrash2 size={15} />, 'Reject', onReject, '#DC2626')}
          {voucher.status === 'posted' && canReverse && item(<FiCornerDownLeft size={15} />, 'Reverse', onReverse, '#B45309')}
          {voucher.status === 'draft' && item(<FiTrash2 size={15} />, 'Delete', onDelete, '#DC2626')}
        </div>
      )}
    </div>
  );
}
