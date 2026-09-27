// client/src/components/common/ActionMenu.jsx
//
// The row "..." actions menu.
//
// WHY THIS RENDERS IN A PORTAL: the menu used to be position:absolute inside the
// table. Every list wraps its table in a card with `overflow: hidden` (for the
// rounded corners) and a scroll container with `overflowX: auto` (ResponsiveTable).
// An absolutely-positioned child is CLIPPED by any such ancestor, so the menu was
// cut off at the edge of the table no matter which direction it opened — the
// flip-up logic was fine, the clipping was the bug. Rendering into document.body
// escapes every clipping ancestor, which is the only reliable fix short of
// removing overflow from every card in the app.
//
// Because it is portalled, the menu is positioned with FIXED viewport coordinates
// taken from the trigger button, and it re-measures on scroll and resize so it
// stays glued to its row. It measures its own height after mount, so the decision
// to open upward or downward is based on the real size, not an estimate:
//   • room below  -> opens downward from the button
//   • no room below but room above -> opens upward
// and it is clamped horizontally so it can never run off-screen.

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMoreVertical } from 'react-icons/fi';

const GAP = 6;        // space between the button and the menu
const EDGE = 8;       // keep at least this much clear of the viewport edge
const MIN_W = 210;    // matches minWidth below, used before the menu is measured

export default function ActionMenu({ items = [], trigger }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState(null);   // { left, top, up }
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Work out where the menu should sit, in viewport coordinates. Uses the menu's
  // real measured size when it is already on screen, and a reasonable estimate
  // for the very first paint.
  const place = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();

    const menuH = menuRef.current?.offsetHeight || Math.min(60 + items.length * 44, 360);
    const menuW = menuRef.current?.offsetWidth || MIN_W;

    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    // Open upward only when there genuinely isn't room below AND there is more
    // room above — otherwise downward stays the natural direction.
    const up = spaceBelow < menuH + GAP + EDGE && spaceAbove > spaceBelow;

    // Right-align the menu to the button, then clamp inside the viewport.
    let left = r.right - menuW;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - menuW - EDGE));

    const top = up ? Math.max(EDGE, r.top - menuH - GAP) : r.bottom + GAP;
    setPos({ left, top, up });
  }, [items.length]);

  const toggleOpen = () => {
    if (!isOpen) place();      // estimate first so the first paint is close
    setIsOpen((v) => !v);
  };

  // Re-measure once the menu is actually in the DOM, so the up/down decision and
  // the position use its true height rather than the estimate.
  useLayoutEffect(() => {
    if (isOpen) place();
  }, [isOpen, place]);

  // Keep the menu attached to its row while the page or any scroll container
  // moves. Capture phase so it also fires for scrolls inside nested containers.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [isOpen, place]);

  // Close on outside click / Escape. The menu lives in a portal, so "outside"
  // has to consider BOTH the trigger and the portalled menu.
  useEffect(() => {
    const handle = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const getColor = (variant, disabled) => {
    if (disabled) return '#CBD5E0';
    if (variant === 'danger') return '#DC2626';
    if (variant === 'warning') return '#D97706';
    if (variant === 'success') return '#16A34A';
    return '#1A3560';
  };

  const menu = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.93, y: pos?.up ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: pos?.up ? 6 : -6 }}
          transition={{ type: 'spring', damping: 28, stiffness: 380 }}
          style={{
            position: 'fixed',
            left: pos ? pos.left : -9999,
            top: pos ? pos.top : -9999,
            transformOrigin: pos?.up ? 'bottom right' : 'top right',
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(26,53,96,0.16)',
            minWidth: MIN_W,
            maxHeight: '70vh',
            overflowY: 'auto',
            zIndex: 4000,   // above the sticky header (150) and the sidebar (100)
          }}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.dividerBefore && i > 0 && (
                <div style={{ height: 1, background: '#F0F4F8', margin: '4px 0' }} />
              )}
              <motion.button
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setIsOpen(false);
                  }
                }}
                whileHover={!item.disabled ? { background: '#F7FAFC' } : {}}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  color: getColor(item.variant, item.disabled),
                  opacity: item.disabled ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 10,
                    background: item.variant === 'danger' ? '#FEE2E2' : '#D1FAE5',
                    color: item.variant === 'danger' ? '#DC2626' : '#065F46',
                  }}>{item.badge}</span>
                )}
              </motion.button>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div ref={triggerRef} style={{ display: 'inline-block' }}>
        {trigger ? (
          <div onClick={toggleOpen} style={{ cursor: 'pointer' }}>{trigger}</div>
        ) : (
          <motion.button
            onClick={toggleOpen}
            whileHover={{ background: '#EBF5FF', borderColor: '#2E75B6' }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid #E2E8F0', background: '#fff',
              fontSize: 13, fontWeight: 500, color: '#1A3560',
              cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            Actions <FiMoreVertical size={14} />
          </motion.button>
        )}
      </div>

      {/* Portalled to body so no card/table overflow can clip it. */}
      {typeof document !== 'undefined' && createPortal(menu, document.body)}
    </div>
  );
}