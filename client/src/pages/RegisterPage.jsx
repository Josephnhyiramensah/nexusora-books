import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheck, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import api from '../services/api';
import nexusoraLogo from '../assets/nexusora-logo.png';
import { getPlatformSettings } from '../services/platformService';

const PLANS = [
  { key: 'trial', name: 'Free Trial', price: 'GHS 0', period: '30 days', color: '#CBD5E1', features: ['2 user accounts', '1 accountant', 'Core accounting modules', 'Journals, invoicing, reports', 'No credit card required'], cta: 'Start Free Trial', popular: false },
  { key: 'starter', name: 'Starter', price: 'GHS 300', period: 'per month', color: '#2563EB', features: ['5 user accounts', '2 accountants', 'All core modules', 'Inventory & fixed assets', 'Payroll (PAYE + SSNIT)', 'Email support'], cta: 'Choose Starter', popular: false },
  { key: 'professional', name: 'Professional', price: 'GHS 990', period: 'per month', color: '#C9A227', features: ['20 user accounts', '5 accountants', 'Everything in Starter', 'AI Anomaly Detection', 'AI Cash Flow Forecast', 'Smart Categorisation', 'Priority support'], cta: 'Choose Professional', popular: true },
 { key: 'enterprise', name: 'Enterprise', price: 'GHS 2,400', period: 'per month', color: '#A5B4FC', features: ['Unlimited users', 'Unlimited accountants', 'Everything in Professional', 'API access', 'White-label option', 'Dedicated support', 'Custom onboarding'], cta: 'Contact Us', popular: false },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTenant, setCreatedTenant] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [companyForm, setCompanyForm] = useState({ companyName: '', subdomain: '', ownerName: '', ownerEmail: '', ownerPhone: '', address: '', city: '', region: '' });
  const [adminForm, setAdminForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });

  useEffect(() => { getPlatformSettings().then(setPlatformSettings); }, []);

  const inputStyle = { width: '100%', padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 };
  const autoSubdomain = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const handleCompanyChange = (field, value) => {
    setCompanyForm((prev) => { const u = { ...prev, [field]: value }; if (field === 'companyName') u.subdomain = autoSubdomain(value); return u; });
  };

  const handleRegister = async () => {
    if (adminForm.password !== adminForm.confirmPassword) { setError('Passwords do not match'); return; }
    if (adminForm.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/tenants/provision', {
        subdomain: companyForm.subdomain, companyName: companyForm.companyName, plan: selectedPlan.key,
        owner: { name: companyForm.ownerName, email: companyForm.ownerEmail, phone: companyForm.ownerPhone },
        settings: { address: companyForm.address, city: companyForm.city, region: companyForm.region },
        adminUser: { firstName: adminForm.firstName, lastName: adminForm.lastName, email: adminForm.email, password: adminForm.password },
      });
      if (data.success) { setCreatedTenant(data.data); setStep(4); }
      else setError(data.message || 'Registration failed');
    } catch (err) { setError(err.response?.data?.message || 'Registration failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const phone = platformSettings?.company?.whatsapp || '233548211310';
  const email = platformSettings?.company?.email || 'nexusoratechnology@gmail.com';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f2240 0%, #1A3560 60%, #1e3d6b 100%)' }}>

      {/* Top Nav */}
      <div style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={nexusoraLogo} alt="Nexusora" style={{ width: 42, height: 42, borderRadius: 10 }} />
          <div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff' }}>Nexusora Books</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Where Knowledge Meets Technology</div>
          </div>
        </div>
        <button onClick={() => navigate('/login')} style={{ padding: '8px 20px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Sign In →</button>
      </div>

      <div style={{ maxWidth: step === 1 ? 1100 : 580, margin: '0 auto', padding: '20px 24px 60px' }}>

        {/* Step 1 — Plans */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Start Managing Your Finances</h1>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 560, margin: '0 auto' }}>Choose the plan that fits your business. Start free for 30 days — no credit card required.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {PLANS.map((plan) => (
                <motion.div key={plan.key} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedPlan(plan); plan.key === 'enterprise' ? setShowEnterpriseModal(true) : setStep(2); }}
                  style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px', cursor: 'pointer', border: plan.popular ? `2px solid ${plan.color}` : '1px solid rgba(255,255,255,0.15)', position: 'relative' }}>
                  {plan.popular && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#1A3560', padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⭐ MOST POPULAR</div>}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{plan.name}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{plan.price}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{plan.period}</div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                        <FiCheck size={14} color={plan.color} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan); plan.key === 'enterprise' ? setShowEnterpriseModal(true) : setStep(2); }}
                    style={{ width: '100%', padding: '12px', borderRadius: 10, background: plan.popular ? plan.color : 'transparent', border: plan.popular ? 'none' : `1px solid ${plan.color}`, color: plan.popular ? '#1A3560' : plan.color, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {plan.cta}
                  </button>
                </motion.div>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 32 }}>🔒 Secure · IFRS-compliant · Made for Ghana businesses · Powered by Nexusora Technologies</p>
          </motion.div>
        )}

        {/* Steps 2 & 3 — Form */}
        {(step === 2 || step === 3) && (
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
              {['Plan', 'Company', 'Admin Account'].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: i < step ? '#C9A227' : i === step - 1 ? '#C9A227' : 'rgba(255,255,255,0.2)', color: i < step || i === step - 1 ? '#1A3560' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {i < step - 1 ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: i === step - 1 ? '#C9A227' : 'rgba(255,255,255,0.5)', fontWeight: i === step - 1 ? 600 : 400 }}>{s}</span>
                  {i < 2 && <div style={{ width: 30, height: 1, background: 'rgba(255,255,255,0.2)' }} />}
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 20, padding: '36px 40px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              {selectedPlan && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '10px 16px', background: '#F8FAFF', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 13, color: '#6B7280' }}>Selected Plan:</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: selectedPlan.color }}>{selectedPlan.name} — {selectedPlan.price} {selectedPlan.key !== 'trial' ? '/mo' : '(30 days free)'}</span>
                  <button onClick={() => setStep(1)} style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}>Change</button>
                </div>
              )}

              {error && <div style={{ padding: '12px 16px', background: '#FEE2E2', borderRadius: 10, color: '#DC2626', fontSize: 13, marginBottom: 20 }}>⚠️ {error}</div>}

              {/* Step 2 */}
              {step === 2 && (
                <>
                  <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#1A3560', marginBottom: 6 }}>Company Details</h2>
                  <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Tell us about your business. This sets up your private workspace.</p>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Company Name *</label>
                    <input style={inputStyle} value={companyForm.companyName} onChange={(e) => handleCompanyChange('companyName', e.target.value)} placeholder="Koinonia Minerals Investment Ltd" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Your Workspace URL *</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                      <input style={{ ...inputStyle, border: 'none', borderRadius: 0, flex: 1 }} value={companyForm.subdomain} onChange={(e) => handleCompanyChange('subdomain', autoSubdomain(e.target.value))} placeholder="yourcompany" />
                      <span style={{ padding: '12px 16px', background: '#F8FAFF', fontSize: 13, color: '#6B7280', borderLeft: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>.nexusorabooks.com</span>
                    </div>
                    {companyForm.subdomain && <p style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>✓ Your login: {companyForm.subdomain}.nexusorabooks.com</p>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div><label style={labelStyle}>Owner Name *</label><input style={inputStyle} value={companyForm.ownerName} onChange={(e) => setCompanyForm((p) => ({ ...p, ownerName: e.target.value }))} placeholder="Full name" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                    <div><label style={labelStyle}>Owner Email *</label><input type="email" style={inputStyle} value={companyForm.ownerEmail} onChange={(e) => setCompanyForm((p) => ({ ...p, ownerEmail: e.target.value }))} placeholder="owner@company.com" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
                    <div><label style={labelStyle}>City</label><input style={inputStyle} value={companyForm.city} onChange={(e) => setCompanyForm((p) => ({ ...p, city: e.target.value }))} placeholder="Kumasi" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                    <div><label style={labelStyle}>Region</label><input style={inputStyle} value={companyForm.region} onChange={(e) => setCompanyForm((p) => ({ ...p, region: e.target.value }))} placeholder="Ashanti" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                    <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={companyForm.ownerPhone} onChange={(e) => setCompanyForm((p) => ({ ...p, ownerPhone: e.target.value }))} placeholder="+233..." onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setStep(1)} style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FiArrowLeft size={14} /> Back</button>
                    <button onClick={() => { if (!companyForm.companyName || !companyForm.subdomain || !companyForm.ownerName || !companyForm.ownerEmail) { setError('Please fill in all required fields'); return; } setError(''); setStep(3); }}
                      style={{ flex: 1, padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #1A3560, #2E75B6)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      Continue <FiArrowRight size={14} />
                    </button>
                  </div>
                </>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <>
                  <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#1A3560', marginBottom: 6 }}>Admin Account</h2>
                  <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Create your administrator account. You'll use this to log in and manage your team.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div><label style={labelStyle}>First Name *</label><input style={inputStyle} value={adminForm.firstName} onChange={(e) => setAdminForm((p) => ({ ...p, firstName: e.target.value }))} placeholder="John" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                    <div><label style={labelStyle}>Last Name *</label><input style={inputStyle} value={adminForm.lastName} onChange={(e) => setAdminForm((p) => ({ ...p, lastName: e.target.value }))} placeholder="Mensah" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Admin Email *</label>
                    <input type="email" style={inputStyle} value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} placeholder="admin@yourcompany.com" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div><label style={labelStyle}>Password *</label><input type="password" style={inputStyle} value={adminForm.password} onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                    <div><label style={labelStyle}>Confirm Password *</label><input type="password" style={inputStyle} value={adminForm.confirmPassword} onChange={(e) => setAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat password" onFocus={(e) => (e.target.style.borderColor = '#2563EB')} onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')} /></div>
                  </div>
                  <div style={{ padding: '12px 16px', background: '#F0F7FF', borderRadius: 10, fontSize: 13, color: '#1E40AF', marginBottom: 24 }}>
                    📋 After registration, your team logs in at <strong>{companyForm.subdomain}.nexusorabooks.com</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setStep(2)} style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FiArrowLeft size={14} /> Back</button>
                    <button onClick={handleRegister} disabled={loading}
                      style={{ flex: 1, padding: '14px', borderRadius: 10, background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #C9A227, #e0b930)', color: '#1A3560', fontSize: 15, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {loading ? (
                        <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 18, height: 18, border: '2px solid #1A3560', borderTopColor: 'transparent', borderRadius: '50%' }} /> Creating your workspace...</>
                      ) : (
                        <>{selectedPlan?.key === 'trial' ? '🚀 Start Free Trial' : '✅ Create Account'}</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && createdTenant && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.6 }} style={{ fontSize: 80, marginBottom: 24 }}>🎉</motion.div>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Welcome to Nexusora Books!</h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32 }}>Your workspace is ready. Your team can now log in and start managing finances.</p>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, marginBottom: 32, border: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Login URL</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#C9A227' }}>{createdTenant.tenant?.subdomain}.nexusorabooks.com</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'left' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>PLAN</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', textTransform: 'capitalize' }}>{createdTenant.tenant?.plan}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>EXPIRES</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {createdTenant.tenant?.plan === 'trial' ? new Date(createdTenant.tenant?.subscription?.expiryDate).toLocaleDateString('en-GB') : 'Active subscription'}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => { if (window.location.hostname === 'localhost') { sessionStorage.setItem('dev_tenant', createdTenant.tenant?.subdomain); window.location.href = `http://localhost:5173/login?tenant=${createdTenant.tenant?.subdomain}`; } else { window.location.href = `https://${createdTenant.tenant?.subdomain}.nexusorabooks.com`; } }}
              style={{ width: '100%', maxWidth: 400, padding: '16px 32px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #C9A227, #e0b930)', color: '#1A3560', fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              Open My Dashboard <FiArrowRight size={18} />
            </button>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 20 }}>Bookmark your URL and share it with your team members.</p>
          </motion.div>
        )}
      </div>

      {/* Enterprise Modal */}
      {showEnterpriseModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowEnterpriseModal(false)}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 20, padding: '40px 36px', maxWidth: 480, width: '100%' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#1A3560', marginBottom: 8 }}>Enterprise Plan</h2>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>Get unlimited users, API access, white-labelling, and dedicated onboarding support. Reach out and we'll set you up.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {[
                { icon: '📞', label: 'WhatsApp / Phone', value: platformSettings?.company?.phone || '+233 548 211 310', href: `https://wa.me/${phone}` },
                { icon: '📧', label: 'Email', value: email, href: `mailto:${email}` },
                { icon: '🌐', label: 'Company', value: platformSettings?.company?.name || 'Nexusora Technology', href: null },
              ].map((contact, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#F8FAFF', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 24 }}>{contact.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{contact.label}</p>
                    {contact.href ? (
                      <a href={contact.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', textDecoration: 'none' }}>
                        {contact.value}
                      </a>
                    ) : (
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#1A3560', margin: 0 }}>{contact.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <a href={`https://wa.me/${phone}?text=Hi, I'm interested in the Nexusora Books Enterprise plan.`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ flex: 1, padding: '13px', borderRadius: 10, background: '#25D366', color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                💬 Chat on WhatsApp
              </a>
              <a href={`mailto:${email}?subject=Nexusora Books Enterprise Enquiry`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ flex: 1, padding: '13px', borderRadius: 10, background: '#1A3560', color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                📧 Send Email
              </a>
            </div>

            <button onClick={() => setShowEnterpriseModal(false)} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#9CA3AF', cursor: 'pointer' }}>
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}