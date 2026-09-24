const axios = require('axios');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const PlatformSettings = require('../models/PlatformSettings');
const { getTenantConnection } = require('../config/db');
const { computeAmount } = require('../utils/pricingResolver');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const PLAN_DAYS = {
  monthly: 30, semi_annual: 180, annual: 365,
};

// Count a tenant's EXTRA active branches (active − 1; head office is free). Opens
// the tenant DB by name. Founding/free tenants are billed no branch fee, so this
// isn't called for them. Any failure → 0 extra (never over-charge on an error).
async function countExtraBranches(tenant) {
  try {
    if (!tenant?.databaseName) return 0;
    const conn = await getTenantConnection(tenant.databaseName);
    // Branch is registered on the connection via registerAllModels; fall back to
    // the raw collection name if the model isn't present.
    const coll = (conn.models.Branch && conn.models.Branch.collection.name) || 'branches';
    const active = await conn.collection(coll).countDocuments({ isActive: true });
    return Math.max(0, active - 1);
  } catch (e) {
    console.error('[Billing] Branch count failed:', e.message);
    return 0;
  }
}

// Load platform settings once (singleton). Null-safe — the resolver falls back to
// built-in defaults when settings or a field is missing.
async function loadSettings() {
  try { return await PlatformSettings.findById('platform').lean(); }
  catch { return null; }
}

// ─── Initialise Payment ───────────────────────────────────────────────────────
const initializePayment = async (req, res) => {
  try {
    const { plan, billingCycle, email, subdomain } = req.body;

    if (!plan || !billingCycle || !email || !subdomain) {
      return res.status(400).json({ success: false, message: 'plan, billingCycle, email, and subdomain are required.' });
    }

    if (plan === 'trial') {
      return res.status(400).json({ success: false, message: 'Trial plan does not require payment.' });
    }

    const tenant = await Tenant.findOne({ subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Company not found.' });

    // Founding/free companies pay nothing for branches — count 0 extra.
    const isFree = tenant.plan === 'founding' || tenant.status === 'founding';
    const extraBranches = isFree ? 0 : await countExtraBranches(tenant);

    // Prices come from the console (PlatformSettings) via the resolver, falling
    // back to built-in defaults. Base plan + per-branch fee, scaled by cycle.
    const settings = await loadSettings();
    const priced = computeAmount(settings, plan, billingCycle, extraBranches);
    if (!priced.ok) return res.status(400).json({ success: false, message: priced.error });

    const amount = priced.amountPesewas; // pesewas, for Paystack
    const reference = `NBK-${subdomain}-${Date.now()}`;

    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount,
        reference,
        currency: 'GHS',
        callback_url: `${process.env.CLIENT_URL}/payment/verify`,
        metadata: {
          subdomain,
          plan,
          billingCycle,
          extraBranches,
          custom_fields: [
            { display_name: 'Company', variable_name: 'subdomain', value: subdomain },
            { display_name: 'Plan', variable_name: 'plan', value: plan },
            { display_name: 'Extra branches', variable_name: 'extra_branches', value: String(extraBranches) },
          ],
        },
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' } }
    );

    const { authorization_url, access_code } = response.data.data;

    res.json({
      success: true,
      data: {
        authorization_url, access_code, reference,
        amount: amount / 100,          // cedis, for display
        breakdown: priced.breakdown,   // base + branches, so the UI can show why
      },
    });
  } catch (error) {
    console.error('[Paystack] Init error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment initialisation failed.' });
  }
};

// ─── Verify Payment ───────────────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ success: false, message: 'Reference required.' });

    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const txn = response.data.data;

    if (txn.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment not successful.', status: txn.status });
    }

    const { subdomain, plan, billingCycle, extraBranches } = txn.metadata;
    const tenant = await Tenant.findOne({ subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const days = PLAN_DAYS[billingCycle] || 30;
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const planLimits = {
      starter: { maxUsers: 5, maxAccountants: 2 },
      professional: { maxUsers: 20, maxAccountants: 5 },
      enterprise: { maxUsers: 9999, maxAccountants: 9999 },
    };

    const limits = planLimits[plan] || planLimits.starter;

    tenant.plan = plan;
    tenant.status = 'active';
    tenant.subscription = {
      ...tenant.subscription,
      plan,
      billingCycle,
      expiryDate,
      amountPaid: txn.amount / 100,
      currency: 'GHS',
      lastPaymentDate: new Date(),
      lastPaymentRef: reference,
      // Record the branch count this payment covered — a clear trail of what the
      // renewal was for (and useful if a paid-branch limit is switched on later).
      paidBranches: Number(extraBranches) || 0,
      maxUsers: limits.maxUsers,
      maxAccountants: limits.maxAccountants,
    };

    await tenant.save();

    res.json({
      success: true,
      message: `Payment verified. ${plan} plan activated until ${expiryDate.toLocaleDateString('en-GB')}.`,
      data: { plan, expiryDate, subdomain },
    });
  } catch (error) {
    console.error('[Paystack] Verify error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment verification failed.' });
  }
};

// ─── Paystack Webhook ─────────────────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature.' });
    }

    const event = req.body;
    console.log('[Paystack Webhook]', event.event, event.data?.reference);

    if (event.event === 'charge.success') {
      const txn = event.data;
      const { subdomain, plan, billingCycle, extraBranches } = txn.metadata || {};

      if (subdomain && plan) {
        const tenant = await Tenant.findOne({ subdomain });
        if (tenant) {
          const days = PLAN_DAYS[billingCycle] || 30;
          tenant.plan = plan;
          tenant.status = 'active';
          tenant.subscription.plan = plan;
          tenant.subscription.expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          tenant.subscription.lastPaymentDate = new Date();
          tenant.subscription.lastPaymentRef = txn.reference;
          tenant.subscription.paidBranches = Number(extraBranches) || 0;
          await tenant.save();
          console.log(`[Webhook] Activated ${plan} for ${subdomain} (${extraBranches || 0} extra branches)`);
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('[Paystack Webhook] Error:', error.message);
    res.sendStatus(500);
  }
};

// ─── Get Subscription Status ──────────────────────────────────────────────────
const getSubscriptionStatus = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const now = new Date();
    const expiry = tenant.subscription?.expiryDate ? new Date(tenant.subscription.expiryDate) : null;
    const daysLeft = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : 0;
    const isExpired = expiry ? now > expiry : false;

    res.json({
      success: true,
      data: {
        plan: tenant.plan,
        status: tenant.status,
        expiryDate: expiry,
        daysLeft: Math.max(0, daysLeft),
        isExpired,
        isActive: !isExpired && tenant.status !== 'suspended',
        subscription: tenant.subscription,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscription.' });
  }
};


// ─── Get Pricing (read-only, for the Upgrade page) ────────────────────────────
// Returns the CURRENT prices (console → defaults) for every plan and cycle, with
// the branch fee already folded in for THIS company's active branch count. So the
// Upgrade page displays real, console-driven, branch-aware totals — no hardcoded
// prices on the frontend.
const getPricing = async (req, res) => {
  try {
    const { subdomain } = req.params;
    const tenant = await Tenant.findOne({ subdomain });
    const isFree = !!tenant && (tenant.plan === 'founding' || tenant.status === 'founding');
    const extraBranches = (tenant && !isFree) ? await countExtraBranches(tenant) : 0;

    const settings = await loadSettings();
    const cycles = ['monthly', 'semi_annual', 'annual'];
    const planKeys = ['starter', 'professional', 'enterprise'];

    const plans = {};
    for (const plan of planKeys) {
      const perCycle = {};
      let baseMonthly = 0;
      let perBranchMonthly = 0;
      for (const cycle of cycles) {
        const r = computeAmount(settings, plan, cycle, extraBranches);
        if (r.ok) {
          perCycle[cycle] = r.breakdown.totalAmount;        // cedis
          baseMonthly = r.breakdown.baseMonthly;
          perBranchMonthly = r.breakdown.perBranchMonthly;
        }
      }
      plans[plan] = { ...perCycle, baseMonthly, perBranchMonthly };
    }

    res.json({ success: true, data: { currency: 'GHS', extraBranches, isFree, plans } });
  } catch (error) {
    console.error('[Billing] getPricing error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load pricing.' });
  }
};

module.exports = { initializePayment, verifyPayment, handleWebhook, getSubscriptionStatus, getPricing };