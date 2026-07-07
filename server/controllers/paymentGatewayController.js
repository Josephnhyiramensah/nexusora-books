const axios = require('axios');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const PLAN_PRICES = {
  starter: { monthly: 30000, semi_annual: 150000, annual: 270000 },
  professional: { monthly: 99000, semi_annual: 495000, annual: 891000 },
  enterprise: { monthly: 240000, semi_annual: 1200000, annual: 2160000 },
};

const PLAN_DAYS = {
  monthly: 30, semi_annual: 180, annual: 365,
};

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

    const prices = PLAN_PRICES[plan];
    if (!prices) return res.status(400).json({ success: false, message: 'Invalid plan.' });

    const amount = prices[billingCycle];
    if (!amount) return res.status(400).json({ success: false, message: 'Invalid billing cycle.' });

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
          custom_fields: [
            { display_name: 'Company', variable_name: 'subdomain', value: subdomain },
            { display_name: 'Plan', variable_name: 'plan', value: plan },
          ],
        },
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' } }
    );

    const { authorization_url, access_code } = response.data.data;

    res.json({
      success: true,
      data: { authorization_url, access_code, reference, amount: amount / 100 },
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

    const { subdomain, plan, billingCycle } = txn.metadata;
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
      const { subdomain, plan, billingCycle } = txn.metadata || {};

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
          await tenant.save();
          console.log(`[Webhook] Activated ${plan} for ${subdomain}`);
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

module.exports = { initializePayment, verifyPayment, handleWebhook, getSubscriptionStatus };