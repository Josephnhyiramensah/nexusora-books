import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import nexusoraLogo from '../assets/nexusora-logo.png';

// ─── Splash Screen (always uses Nexusora logo — never company logo) ──────────
function SplashReveal({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 0.5 }}
      style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f2240 0%, #1A3560 50%, #1e3d6b 100%)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {/* Real Nexusora Logo — spin zoom in */}
        <motion.div
          initial={{ scale: 0.05, rotate: -360, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 11, stiffness: 90, duration: 1.4 }}
          style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}
        >
          <img
            src={nexusoraLogo}
            alt="Nexusora Books"
            style={{
              width: 110, height: 110,
              borderRadius: 28,
              boxShadow: '0 16px 48px rgba(201,162,39,0.45)',
            }}
          />
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.55 }}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 34, fontWeight: 800, color: '#fff', marginBottom: 8,
            letterSpacing: '-0.5px',
          }}
        >
          Nexusora Books
        </motion.h1>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 0.45 }}
          style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 40 }}
        >
          Where Knowledge Meets Technology
        </motion.p>

        {/* Animated dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          style={{ display: 'flex', gap: 10, justifyContent: 'center' }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
              style={{
                width: 9, height: 9, borderRadius: '50%',
                background: '#C9A227',
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login, verifyTwoFactor, isAuthenticated, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [showSplash, setShowSplash] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── 2FA second step ─────────────────────────────────────────────────────
  // When the password step returns twoFactorRequired, we hold the short-lived
  // challenge token and switch the card to a code-entry view. No session exists
  // yet — the user is authenticated only once the code verifies.
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  useEffect(() => {
    if (isAuthenticated) navigate('/home', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (error) { setLocalError(error); clearError(); }
  }, [error, clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) { setLocalError('Please enter your email and password.'); return; }
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    // 2FA-enabled account: switch to the code-entry step instead of navigating.
    if (result.twoFactorRequired) {
      setChallengeToken(result.challengeToken);
      setTwoFactorStep(true);
      return;
    }

    if (result.success) navigate('/home', { replace: true });
    else setLocalError(result.message || 'Login failed. Please check your credentials.');
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLocalError('');
    const entered = useBackup ? backupCode.trim() : code.trim();
    if (!entered) { setLocalError(useBackup ? 'Enter a backup code.' : 'Enter the 6-digit code.'); return; }

    setSubmitting(true);
    const result = await verifyTwoFactor(
      challengeToken,
      useBackup ? { backupCode: entered } : { code: entered }
    );
    setSubmitting(false);

    if (result.success) {
      navigate('/home', { replace: true });
    } else {
      // If the challenge expired, send the user back to the password step.
      if (result.message && /expired|session/i.test(result.message)) {
        setTwoFactorStep(false);
        setChallengeToken('');
        setCode(''); setBackupCode('');
      }
      setLocalError(result.message || 'Verification failed. Please try again.');
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px 12px 44px',
    border: '1.5px solid #E2E8F0',
    borderRadius: 10, fontSize: 14,
    color: '#1A3560', outline: 'none',
    transition: 'border-color 150ms, box-shadow 150ms',
    background: '#fff',
  };

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <SplashReveal key="splash" onComplete={() => setShowSplash(false)} />
      ) : (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
          style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f2240 0%, #1A3560 55%, #1e3d6b 100%)',
            padding: 16,
          }}
        >
          {/* Login Card */}
          <motion.div
            initial={{ scale: 0.88, y: 36, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.1 }}
            style={{
              width: '100%', maxWidth: 420,
              background: '#fff', borderRadius: 20,
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
              overflow: 'hidden',
            }}
          >
            {/* Card Header — ALWAYS Nexusora branding, never company logo */}
            <div style={{
              background: 'linear-gradient(160deg, #0f2240 0%, #1A3560 100%)',
              padding: 'clamp(20px, 5vw, 40px)',
              textAlign: 'center',
            }}>
              <motion.div
            initial={{ scale: 0.2, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 180, delay: 0.3 }}
            style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }}
          >
                <img
                  src={nexusoraLogo}
                  alt="Nexusora Books"
                  style={{
                    width: 68, height: 68,
                    borderRadius: 18,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}
                />
              </motion.div>

              <motion.h1
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.52, duration: 0.38 }}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 22, fontWeight: 700,
                  color: '#fff', marginBottom: 0, letterSpacing: '-0.3px',
                }}
              >
                Nexusora Books
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}
              >
                Where Knowledge Meets Technology
              </motion.p>
            </div>

            {/* Form Section */}
            <div style={{ padding: '32px 40px 36px' }}>
              <motion.h2
                initial={{ x: -18, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.32 }}
                style={{
                  fontSize: 18, fontWeight: 700,
                  color: '#1A3560', marginBottom: 22,
                }}
              >
                Sign in to your account
              </motion.h2>

              {/* Error */}
              <AnimatePresence>
                {localError && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{
                      padding: '11px 14px',
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      borderRadius: 10, color: '#DC2626',
                      fontSize: 13, marginBottom: 18, overflow: 'hidden',
                    }}
                  >
                    ⚠️ {localError}
                  </motion.div>
                )}
              </AnimatePresence>

              {twoFactorStep ? (
                <form onSubmit={handleVerify2FA}>
                  <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>
                    {useBackup
                      ? 'Enter one of your saved backup codes.'
                      : 'Enter the 6-digit code from your authenticator app.'}
                  </p>

                  {!useBackup ? (
                    <input
                      autoFocus
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      style={{
                        width: '100%', padding: '14px', textAlign: 'center',
                        fontSize: 24, letterSpacing: '0.4em', fontWeight: 700,
                        border: '1.5px solid #E2E8F0', borderRadius: 10, color: '#1A3560',
                        outline: 'none', marginBottom: 20, boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <input
                      autoFocus
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      placeholder="XXXXX-XXXXX"
                      style={{
                        width: '100%', padding: '14px', textAlign: 'center',
                        fontSize: 18, letterSpacing: '0.15em', fontWeight: 700,
                        border: '1.5px solid #E2E8F0', borderRadius: 10, color: '#1A3560',
                        outline: 'none', marginBottom: 20, boxSizing: 'border-box',
                      }}
                    />
                  )}

                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.97 }}
                    style={{
                      width: '100%', padding: '13px 24px',
                      background: submitting ? '#9CA3AF' : 'linear-gradient(135deg, #1A3560 0%, #2E75B6 100%)',
                      color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700,
                      border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Verifying…' : 'Verify & Sign In'}
                  </motion.button>

                  <div style={{ textAlign: 'center', marginTop: 18 }}>
                    <button
                      type="button"
                      onClick={() => { setUseBackup(!useBackup); setLocalError(''); setCode(''); setBackupCode(''); }}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {useBackup ? '← Use authenticator code' : 'Use a backup code instead'}
                    </button>
                  </div>
                </form>
              ) : (
              <form onSubmit={handleSubmit}>
                {/* Email */}
                <motion.div
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  style={{ marginBottom: 16 }}
                >
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Email address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FiMail size={17} style={{
                      position: 'absolute', left: 14, top: '50%',
                      transform: 'translateY(-50%)', color: '#9CA3AF',
                    }} />
                    <input
                      id="email" type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      style={inputStyle}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563EB';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E2E8F0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </motion.div>

                {/* Password */}
                <motion.div
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  style={{ marginBottom: 24 }}
                >
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FiLock size={17} style={{
                      position: 'absolute', left: 14, top: '50%',
                      transform: 'translateY(-50%)', color: '#9CA3AF',
                    }} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563EB';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E2E8F0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute', right: 14, top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9CA3AF', padding: 4, background: 'none', border: 'none', cursor: 'pointer',
                      }}
                    >
                      {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                    </button>
                  </div>
                </motion.div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={submitting}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ scale: submitting ? 1 : 1.02, boxShadow: submitting ? 'none' : '0 8px 24px rgba(37,99,235,0.3)' }}
                  whileTap={{ scale: submitting ? 1 : 0.97 }}
                  style={{
                    width: '100%', padding: '13px 24px',
                    background: submitting
                      ? '#9CA3AF'
                      : 'linear-gradient(135deg, #1A3560 0%, #2E75B6 100%)',
                    color: '#fff',
                    borderRadius: 10, fontSize: 15, fontWeight: 700,
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.2px',
                  }}
                >
                  {submitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{
                          width: 17, height: 17,
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                        }}
                      />
                      Signing in...
                    </span>
                  ) : 'Sign In'}
                </motion.button>
              </form>
              )}

              {/* Register Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                style={{ textAlign: 'center', marginTop: 22 }}
              >
                <p style={{ fontSize: 13, color: '#6B7280' }}>
                  Don't have an account?{' '}
                  <Link to="/register" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                    Start free trial →
                  </Link>
                </p>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                style={{
                  textAlign: 'center', fontSize: 11,
                  color: '#D1D5DB', marginTop: 20,
                }}
              >
                Powered by Nexusora Technologies 
              </motion.p>
            </div>
           <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
  style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 28 }}>
  Powered by Nexusora Technologies · © 2026
</motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}