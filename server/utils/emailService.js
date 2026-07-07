const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"${process.env.FROM_NAME || 'Nexusora Books'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`;

// ─── Base HTML template ───────────────────────────────────────────────────────
function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexusora Books</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0f2240,#1A3560);padding:32px 40px;text-align:center;">
          <div style="background:linear-gradient(135deg,#C9A227,#e0b930);width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
            <span style="font-size:28px;font-weight:800;color:#1A3560;">N</span>
          </div>
          <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 4px;">Nexusora Books</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;">Where Knowledge Meets Technology</p>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:36px 40px;">${content}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#F8FAFF;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="font-size:12px;color:#9CA3AF;margin:0;">
            © ${new Date().getFullYear()} Nexusora Technologies · Kumasi, Ghana<br>
            Developed by Prof. JNK Mensah
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Welcome Email ─────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ to, companyName, subdomain, adminName, plan, expiryDate }) {
  const loginUrl = `https://${subdomain}.nexusorabooks.com`;
  const isTrialPlan = plan === 'trial';

  const content = `
    <h2 style="color:#1A3560;font-size:22px;font-weight:700;margin:0 0 8px;">Welcome, ${adminName}! 🎉</h2>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Your Nexusora Books workspace for <strong>${companyName}</strong> is ready. 
      ${isTrialPlan ? `Your <strong>30-day free trial</strong> ends on <strong>${new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.` : `Your <strong>${plan}</strong> plan is now active.`}
    </p>

    <div style="background:#F0F7FF;border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #DBEAFE;">
      <p style="font-size:12px;color:#6B7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">YOUR LOGIN URL</p>
      <p style="font-size:18px;font-weight:700;color:#2563EB;margin:0;">${loginUrl}</p>
    </div>

    <div style="margin-bottom:28px;">
      <p style="font-size:14px;color:#374151;font-weight:600;margin:0 0 12px;">Getting started:</p>
      ${['Log in at your workspace URL above', 'Go to Settings → Users to add your team', 'Set up your Chart of Accounts', 'Create your first invoice or journal entry'].map((step, i) => `
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
          <div style="width:24px;height:24px;border-radius:50%;background:#C9A227;color:#1A3560;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
          <span style="font-size:14px;color:#6B7280;line-height:1.5;">${step}</span>
        </div>`).join('')}
    </div>

    <a href="${loginUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#C9A227,#e0b930);color:#1A3560;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
      Open My Dashboard →
    </a>

    ${isTrialPlan ? `
    <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:20px 0 0;">
      After your trial, plans start from GHS 300/month. 
      <a href="${loginUrl}/settings" style="color:#2563EB;">Upgrade anytime in Settings.</a>
    </p>` : ''}`;

  await transporter.sendMail({
    from: FROM, to,
    subject: `🎉 Welcome to Nexusora Books — Your workspace is ready!`,
    html: baseTemplate(content),
  });

  console.log(`[Email] Welcome email sent to ${to}`);
}

// ─── Trial Expiry Reminder ─────────────────────────────────────────────────────
async function sendTrialExpiryEmail({ to, companyName, adminName, subdomain, daysLeft, expiryDate }) {
  const loginUrl = `https://${subdomain}.nexusorabooks.com`;
  const upgradeUrl = `${loginUrl}/upgrade`;

  const content = `
    <h2 style="color:#D97706;font-size:22px;font-weight:700;margin:0 0 8px;">⏰ Your trial ${daysLeft === 1 ? 'expires tomorrow' : `expires in ${daysLeft} days`}</h2>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Hi ${adminName}, your free trial for <strong>${companyName}</strong> ends on 
      <strong>${new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
      Upgrade now to keep access to all your data.
    </p>

    <div style="background:#FEF3C7;border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #FDE68A;">
      <p style="font-size:14px;color:#92400E;font-weight:600;margin:0 0 12px;">Choose your plan:</p>
      ${[
        { name: 'Starter', price: 'GHS 300/mo', color: '#2563EB', features: '5 users, all core modules' },
        { name: 'Professional', price: 'GHS 990/mo', color: '#C9A227', features: '20 users + AI features' },
        { name: 'Enterprise', price: 'GHS 2,400/mo', color: '#1A3560', features: 'Unlimited users + API access' },
      ].map((p) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #FDE68A;">
          <div>
            <span style="font-weight:700;color:${p.color};">${p.name}</span>
            <span style="font-size:12px;color:#6B7280;margin-left:8px;">${p.features}</span>
          </div>
          <span style="font-weight:700;color:#1A3560;">${p.price}</span>
        </div>`).join('')}
    </div>

    <a href="${upgradeUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#1A3560,#2E75B6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;margin-bottom:16px;">
      Upgrade My Plan →
    </a>
    <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0;">Questions? Email us at support@nexusorabooks.com</p>`;

  await transporter.sendMail({
    from: FROM, to,
    subject: `⏰ Your Nexusora Books trial ${daysLeft === 1 ? 'expires tomorrow' : `expires in ${daysLeft} days`} — Upgrade now`,
    html: baseTemplate(content),
  });

  console.log(`[Email] Trial expiry reminder sent to ${to}`);
}

// ─── Payment Confirmation ──────────────────────────────────────────────────────
async function sendPaymentConfirmationEmail({ to, companyName, adminName, plan, amount, billingCycle, expiryDate, reference }) {
  const content = `
    <h2 style="color:#16A34A;font-size:22px;font-weight:700;margin:0 0 8px;">✅ Payment Confirmed!</h2>
    <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Thank you, ${adminName}. Your payment for <strong>${companyName}</strong> has been received and your subscription is now active.
    </p>

    <div style="background:#F0FDF4;border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #A7F3D0;">
      ${[
        ['Plan', plan.charAt(0).toUpperCase() + plan.slice(1)],
        ['Billing Cycle', billingCycle.replace('_', ' ')],
        ['Amount Paid', `GHS ${amount.toLocaleString()}`],
        ['Valid Until', new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Reference', reference],
      ].map(([label, value]) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #A7F3D0;">
          <span style="font-size:13px;color:#6B7280;">${label}</span>
          <span style="font-size:13px;font-weight:600;color:#1A3560;">${value}</span>
        </div>`).join('')}
    </div>
    <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0;">Keep this email as your payment receipt. Thank you for choosing Nexusora Books!</p>`;

  await transporter.sendMail({
    from: FROM, to,
    subject: `✅ Payment Confirmed — ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated`,
    html: baseTemplate(content),
  });
}

module.exports = { sendWelcomeEmail, sendTrialExpiryEmail, sendPaymentConfirmationEmail };