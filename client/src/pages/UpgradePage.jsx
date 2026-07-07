import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheck, FiZap, FiClock, FiArrowLeft } from 'react-icons/fi';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const PLANS = [
  {
    key: 'starter', name: 'Starter', color: '#2563EB',
    prices: { monthly: 300, semi_annual: 1500, annual: 2700 },
    features: ['5 user accounts', '2 accountants', 'All core modules', 'Inventory & fixed assets', 'Payroll (PAYE + SSNIT)', 'Email support'],
  },
  {
    key: 'professional', name: 'Professional', color: '#C9A227', popular: true,
    prices: { monthly: 990, semi_annual: 4950, annual: 8910 },
    features: ['20 user accounts', '5 accountants', 'Everything in Starter', 'AI Anomaly Detection', 'AI Cash Flow Forecast', 'Smart Categorisation', 'Priority support'],
  },
  {
    key: 'enterprise', name: 'Enterprise', color: '#1A3560',
    prices: { monthly: 2400, semi_annual: 12000, annual: 21600 },
    features: ['Unlimited users', 'Unlimited accountants', 'Everything in Professional', 'API access', 'White-label option', 'Dedicated support'],
  },
];

const CYCLES = [
  { key: 'monthly', label: 'Monthly', discount: null },
  { key: 'semi_annual', label: '6 Months', discount: 'Save 17%' },
  { key: 'annual', label: 'Annual', discount: 'Save 25%' },
];

export default function UpgradePage() {
  const { companyName, subdomain, plan: currentPlan, settings } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState('');
  const [subStatus, setSubStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await api.get(`/payment/status/${subdomain}`);
        if (data.success) setSubStatus(data.data);
      } catch {}
    };
    if (subdomain) fetchStatus();
  }, [subdomain]);

  const handleUpgrade = async (planKey) => {
    if (!user?.email) { showToast('Cannot find your email. Please log out and back in.', 'error'); return; }

    setLoading(planKey);
    try {
      const { data } = await api.post('/payment/initialize', {
        plan: planKey,
        billingCycle,
        email: user.email,
        subdomain,
      });

      if (data.success) {
        // Redirect to Paystack payment page
        window.location.href = data.data.authorization_url;
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Payment initialisation failed', 'error');
    } finally { setLoading(''); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f2240, #1A3560)', padding: '32px 24px' }}>
      {ToastComponent}

      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Back */}
        <motion.button onClick={() => navigate('/home')} whileHover={{ x: -4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32 }}>
          <FiArrowLeft size={16} /> Back to Dashboard
        </motion.button>

        {/* Current Status Banner */}
        {subStatus && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: subStatus.daysLeft <= 3 ? 'rgba(220,38,38,0.15)' : 'rgba(201,162,39,0.15)',
              border: `1px solid ${subStatus.daysLeft <= 3 ? 'rgba(220,38,38,0.3)' : 'rgba(201,162,39,0.3)'}`,
              borderRadius: 12, padding: '16px 24px', marginBottom: 32,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            <FiClock size={20} color={subStatus.daysLeft <= 3 ? '#DC2626' : '#C9A227'} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>
                {subStatus.isExpired
                  ? '⚠️ Your subscription has expired'
                  : currentPlan === 'trial'
                    ? `Free trial: ${subStatus.daysLeft} day${subStatus.daysLeft !== 1 ? 's' : ''} remaining`
                    : `${currentPlan} plan — active until ${new Date(subStatus.expiryDate).toLocaleDateString('en-GB')}`}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>
                {companyName} · {subdomain}.nexusorabooks.com
              </p>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
            {currentPlan === 'trial' ? 'Upgrade Your Plan' : 'Manage Subscription'}
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
            All plans include IFRS-compliant accounting for Ghanaian businesses. Powered by Paystack.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 36 }}>
          {CYCLES.map((c) => (
            <motion.button key={c.key} onClick={() => setBillingCycle(c.key)}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{
                padding: '10px 20px', borderRadius: 10,
                background: billingCycle === c.key ? '#C9A227' : 'rgba(255,255,255,0.1)',
                color: billingCycle === c.key ? '#1A3560' : '#fff',
                border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                position: 'relative',
              }}>
              {c.label}
              {c.discount && billingCycle === c.key && (
                <span style={{ position: 'absolute', top: -8, right: -8, background: '#16A34A', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>
                  {c.discount}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Plan Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 40 }}>
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const price = plan.prices[billingCycle];
            return (
              <motion.div key={plan.key}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                style={{
                  background: '#fff', borderRadius: 16, padding: '28px 24px',
                  border: plan.popular ? `2px solid ${plan.color}` : '1px solid rgba(255,255,255,0.2)',
                  position: 'relative',
                }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#1A3560', padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    ⭐ MOST POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: 14, right: 14, background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    Current
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{plan.name}</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 34, fontWeight: 800, color: '#1A3560' }}>GHS {price.toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#9CA3AF' }}>
                    {billingCycle === 'monthly' ? 'per month' : billingCycle === 'semi_annual' ? 'every 6 months' : 'per year'}
                    {billingCycle !== 'monthly' && (
                      <span style={{ color: '#16A34A', fontWeight: 600, marginLeft: 6 }}>
                        (GHS {Math.round(price / (billingCycle === 'semi_annual' ? 6 : 12)).toLocaleString()}/mo)
                      </span>
                    )}
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                      <FiCheck size={14} color={plan.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#6B7280' }}>{f}</span>
                    </div>
                  ))}
                </div>

                <motion.button
                  onClick={() => !isCurrent && handleUpgrade(plan.key)}
                  disabled={isCurrent || loading === plan.key}
                  whileHover={!isCurrent ? { scale: 1.02 } : {}}
                  whileTap={!isCurrent ? { scale: 0.98 } : {}}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                    background: isCurrent ? '#F3F4F6' : plan.popular ? plan.color : '#1A3560',
                    color: isCurrent ? '#9CA3AF' : plan.popular ? '#1A3560' : '#fff',
                    fontSize: 14, fontWeight: 700,
                    cursor: isCurrent || loading === plan.key ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {loading === plan.key ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} /> Processing...</>
                  ) : isCurrent ? 'Current Plan' : (
                    <><FiZap size={14} /> Upgrade to {plan.name}</>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* Trust signals */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {['🔒 Secured by Paystack', '🇬🇭 Ghana Cedis (GHS)', '📧 24/7 Email Support', '🔄 Cancel anytime'].map((item, i) => (
            <span key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}