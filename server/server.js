require('dotenv').config();

console.log('🔑 ANTHROPIC KEY LOADED:', process.env.ANTHROPIC_API_KEY
  ? process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...'
  : 'NOT FOUND ❌');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectMasterDB, closeAllConnections } = require('./config/db');
const tenantMiddleware = require('./middleware/tenantMiddleware');
const enforceSubscription = require('./middleware/subscriptionMiddleware');

// ─── Route imports ────────────────────────────────────────────────────────────
const tenantRoutes       = require('./routes/tenantRoutes');
const authRoutes         = require('./routes/authRoutes');
const accountRoutes      = require('./routes/accountRoutes');
const journalRoutes      = require('./routes/journalRoutes');
const customerRoutes     = require('./routes/customerRoutes');
const vendorRoutes       = require('./routes/vendorRoutes');
const invoiceRoutes      = require('./routes/invoiceRoutes');
const billRoutes         = require('./routes/billRoutes');
const paymentRoutes      = require('./routes/paymentRoutes');       // accounting payments
const paymentGwRoutes    = require('./routes/paymentGatewayRoutes'); // Paystack gateway
const reportRoutes       = require('./routes/reportRoutes');
const noteRoutes         = require('./routes/noteRoutes');
const todoRoutes         = require('./routes/todoRoutes');
const dashboardRoutes    = require('./routes/dashboardRoutes');
const fixedAssetRoutes   = require('./routes/fixedAssetRoutes');
const payrollRoutes      = require('./routes/payrollRoutes');
const bankRoutes         = require('./routes/bankRoutes');
const budgetRoutes       = require('./routes/budgetRoutes');
const taxRoutes          = require('./routes/taxRoutes');
const userRoutes         = require('./routes/userRoutes');
const aiRoutes           = require('./routes/aiRoutes');
const inventoryRoutes    = require('./routes/inventoryRoutes');
const uploadRoutes       = require('./routes/uploadRoutes');
const auditRoutes        = require('./routes/auditRoutes');
const apiKeyRoutes       = require('./routes/apiKeyRoutes');
const externalApiRoutes  = require('./routes/externalApiRoutes');
const platformRoutes     = require('./routes/platformRoutes');
const platformAuthRoutes = require('./routes/platformAuthRoutes');
const app = express();
const PORT = process.env.PORT || 5000;

// Behind Nginx. Without this, Express sees every request as coming from
// 127.0.0.1 — rate limiting counts all users as one client, and audit logs
// record the proxy instead of the visitor. '1' = trust exactly one proxy hop.
app.set('trust proxy', 1);
app.disable('x-powered-by');
// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // No origin = same-origin, curl, or server-to-server. Allow.
    if (!origin) return cb(null, true);
    if (process.env.NODE_ENV === 'development') return cb(null, true);

    // Production allowlist: the apps themselves, any tenant subdomain, and the company site.
    let host;
    try { host = new URL(origin).hostname; } catch { return cb(new Error('Invalid origin')); }

    const allowed =
      host === 'nexusorabooks.com' ||
      host.endsWith('.nexusorabooks.com') ||
      host === 'nexusoratech.com' ||
      host.endsWith('.nexusoratech.com');

    return allowed ? cb(null, true) : cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Webhook must use raw body — register BEFORE express.json()
app.post('/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/paymentGatewayController').handleWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
// ─── Rate limiting ────────────────────────────────────────────────────────────
// Keyed per tenant+IP so one noisy tenant cannot exhaust another's budget.
const tenantKey = (req) => {
  const host = (req.hostname || '').toLowerCase();
  const sub = host.split('.').length >= 3 ? host.split('.')[0] : 'apex';
  return `${sub}:${req.ip}`;
};

// General API limiter.
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: tenantKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
}));

// Strict limiter on credential endpoints — the brute-force surface.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: tenantKey,
  skipSuccessfulRequests: true,   // only failed attempts count
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/platform-auth/login', authLimiter);

// Signup abuse — stop automated tenant creation.
app.use('/api/tenants/provision', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: { success: false, message: 'Too many signup attempts. Please try again later.' },
}));
// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Nexusora Books API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── Public routes (no auth, no tenant) ──────────────────────────────────────
app.use('/api/tenants',          tenantRoutes);
app.use('/api/payment',          paymentGwRoutes);   // Paystack: initialize, verify, status

// ─── Tenant-scoped routes (auth required) ────────────────────────────────────
const tm  = tenantMiddleware;
const es  = enforceSubscription;

app.use('/api/auth',             tm,       authRoutes);
app.use('/api/users',            tm, es,   userRoutes);
app.use('/api/accounts',         tm, es,   accountRoutes);
app.use('/api/journals',         tm, es,   journalRoutes);
app.use('/api/customers',        tm, es,   customerRoutes);
app.use('/api/vendors',          tm, es,   vendorRoutes);
app.use('/api/invoices',         tm, es,   invoiceRoutes);
app.use('/api/bills',            tm, es,   billRoutes);
app.use('/api/payments',         tm, es,   paymentRoutes);
app.use('/api/reports',          tm, es,   reportRoutes);
app.use('/api/notes',            tm, es,   noteRoutes);
app.use('/api/todos',            tm, es,   todoRoutes);
app.use('/api/dashboard',        tm, es,   dashboardRoutes);
app.use('/api/fixed-assets',     tm, es,   fixedAssetRoutes);
app.use('/api/payroll',          tm, es,   payrollRoutes);
app.use('/api/bank-accounts',    tm, es,   bankRoutes);
app.use('/api/budgets',          tm, es,   budgetRoutes);
app.use('/api/tax',              tm, es,   taxRoutes);
app.use('/api/ai',               tm, es,   aiRoutes);
app.use('/api/inventory',        tm, es,   inventoryRoutes);
app.use('/api/audit',            tm, es,   auditRoutes);
app.use('/api/upload',           tm,       uploadRoutes);
app.use('/api/platform', platformRoutes);

// Platform administration auth — NO tenantMiddleware. A platform admin logs in
// at the apex domain (nexusorabooks.com) where no tenant exists.
app.use('/api/platform-auth', platformAuthRoutes);
// Internal: manage API keys (authenticated users)
app.use('/api/api-keys', tm, es, apiKeyRoutes);

// External: third-party systems use these with Bearer API key
app.use('/external/v1', externalApiRoutes);

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error.',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectMasterDB();
    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║          NEXUSORA BOOKS API SERVER               ║');
      console.log('║    Where Knowledge Meets Technology              ║');
      console.log('╠══════════════════════════════════════════════════╣');
      console.log(`║  Environment : ${process.env.NODE_ENV || 'development'}`.padEnd(51) + '║');
      console.log(`║  Port        : ${PORT}`.padEnd(51) + '║');
      console.log(`║  Routes      : 22 modules loaded`.padEnd(51) + '║');
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
};

// ─── Trial reminder cron (every 10 min, fires at 8am) ────────────────────────
const { sendTrialReminders } = require('./utils/trialReminder');
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 8 && now.getMinutes() < 10) {
    await sendTrialReminders();
  }
}, 10 * 60 * 1000);

process.on('SIGINT',  async () => { await closeAllConnections(); process.exit(0); });
process.on('SIGTERM', async () => { await closeAllConnections(); process.exit(0); });

startServer();
module.exports = app;