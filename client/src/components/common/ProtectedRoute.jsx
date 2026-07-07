import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

function SplashScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'linear-gradient(135deg, #0f2240 0%, #1A3560 50%, #1e3d6b 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.3, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 100 }}
          style={{
            width: 80, height: 80, borderRadius: 20,
            background: 'linear-gradient(135deg, #C9A227, #e0b930)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 40,
            color: '#1A3560', marginBottom: 24,
            boxShadow: '0 8px 32px rgba(201, 162, 39, 0.3)',
          }}
        >N</motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          style={{ fontFamily: "'Poppins', sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8 }}
        >Nexusora Books</motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div key={i}
              animate={{ scale: [0.6, 1, 0.6], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.16 }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A227' }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <SplashScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles && user && !roles.includes(user.role)) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)' }}>You don't have permission to access this page.</p>
        </div>
      </motion.div>
    );
  }

  return children;
}