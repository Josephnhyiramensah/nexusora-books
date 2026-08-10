import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

// This page loads on the APEX domain (nexusorabooks.com/payment/verify) after
// Paystack redirects back. There is NO tenant subdomain here, so we must NOT use
// the tenant-aware `api` axios instance (it fails with "No tenant identified").
// The verify endpoint needs only the reference, so we call it with a plain fetch.
export default function PaymentVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [subdomain, setSubdomain] = useState('');

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) { setStatus('error'); setMessage('No payment reference found.'); return; }

    const verify = async () => {
      try {
        const res = await fetch(`/api/payment/verify/${encodeURIComponent(reference)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus('success');
          setMessage(data.message || 'Payment verified.');
          if (data.data?.subdomain) setSubdomain(data.data.subdomain);
          // Send them to their workspace (subdomain) after a moment.
          setTimeout(() => {
            if (data.data?.subdomain) {
              window.location.href = `https://${data.data.subdomain}.nexusorabooks.com/home`;
            } else {
              navigate('/');
            }
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.message || 'Payment verification failed.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Verification failed. Please contact support.');
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
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>
              {subdomain ? 'Redirecting to your workspace...' : 'You can now return to your workspace.'}
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 64, marginBottom: 20 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>Payment Failed</h2>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>{message}</p>
            <button onClick={() => navigate('/')}
              style={{ padding: '12px 28px', borderRadius: 10, background: '#1A3560', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Back
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}