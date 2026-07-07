import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';

export default function PaymentVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshTenant } = useTenant();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) { setStatus('error'); setMessage('No payment reference found.'); return; }

    const verify = async () => {
      try {
        const { data } = await api.get(`/payment/verify/${reference}`);
        if (data.success) {
          setStatus('success');
          setMessage(data.message);
          await refreshTenant();
          setTimeout(() => navigate('/home'), 3000);
        } else {
          setStatus('error');
          setMessage(data.message || 'Payment verification failed.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. Please contact support.');
      }
    };

    verify();
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f2240, #1A3560)', padding: 24,
    }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center' }}>

        {status === 'verifying' && (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ width: 56, height: 56, border: '4px solid #E2E8F0', borderTopColor: '#C9A227', borderRadius: '50%', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A3560', marginBottom: 8 }}>Verifying Payment...</h2>
            <p style={{ fontSize: 14, color: '#9CA3AF' }}>Please wait while we confirm your payment with Paystack.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}
              style={{ fontSize: 64, marginBottom: 20 }}>✅</motion.div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#16A34A', marginBottom: 8 }}>Payment Successful!</h2>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>{message}</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Redirecting to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 64, marginBottom: 20 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>Payment Failed</h2>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>{message}</p>
            <button onClick={() => navigate('/upgrade')}
              style={{ padding: '12px 28px', borderRadius: 10, background: '#1A3560', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Try Again
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}