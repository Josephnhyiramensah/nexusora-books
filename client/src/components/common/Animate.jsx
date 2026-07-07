import { motion, AnimatePresence } from 'framer-motion';

// Fade in with upward movement
export function FadeIn({ children, delay = 0, duration = 0.4, y = 20, className, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Staggered children
export function StaggerContainer({ children, staggerDelay = 0.08, style }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, style }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
      }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Slide in from left (sidebar)
export function SlideInLeft({ children, duration = 0.45, style }) {
  return (
    <motion.div
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Drop from top (header)
export function DropDown({ children, duration = 0.4, style }) {
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration, ease: 'easeOut' }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Scale + fade for tables
export function GrowIn({ children, delay = 0, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0.9, originY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Page transition wrapper
export function PageTransition({ children, key: pageKey }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Modal animation
export function ModalAnimation({ children, isOpen }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{
              type: 'spring', damping: 20, stiffness: 300,
            }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Toast slide in
export function ToastAnimation({ children, isVisible }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}