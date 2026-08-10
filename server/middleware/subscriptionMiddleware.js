// server/middleware/subscriptionMiddleware.js
//
// Enforces subscription state on tenant data routes. Founding tenants are always
// exempt. Suspended tenants are fully blocked. EXPIRED tenants are put into a
// read-only state: they can still GET (view) their data, but any write
// (POST/PUT/PATCH/DELETE) is refused with 403 SUBSCRIPTION_EXPIRED until they
// renew. Login (/api/auth) and payment (/api/payment) are mounted WITHOUT this
// middleware, so an expired tenant can always sign in and pay to reactivate.

const Tenant = require('../models/Tenant');

// Methods that only read data — always allowed, even when expired.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const enforceSubscription = async (req, res, next) => {
  try {
    if (!req.tenant) return next();

    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    // Founding tenants never hit the paywall.
    if (tenant.plan === 'founding' || tenant.status === 'founding') return next();

    // Suspended is a hard block (distinct from expiry) — no read, no write.
    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'SUSPENDED',
        message: 'Your account has been suspended. Please contact support at support@nexusorabooks.com.',
      });
    }

    const now = new Date();
    const expiry = tenant.subscription?.expiryDate ? new Date(tenant.subscription.expiryDate) : null;
    const isExpired = expiry ? now > expiry : false;

    if (isExpired) {
      // Flip the stored status once so the rest of the platform (console, lists)
      // reflects reality.
      if (tenant.status !== 'expired') {
        tenant.status = 'expired';
        await tenant.save();
      }

      // Read-only jail: allow reads so the tenant can still see their data and
      // the app can render the renew paywall; refuse writes until they pay.
      if (READ_METHODS.has(req.method)) {
        req.subscription = {
          plan: tenant.plan,
          status: 'expired',
          expired: true,
          daysLeft: 0,
          expiryDate: expiry,
        };
        return next();
      }

      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        expired: true,
        plan: tenant.plan,
        expiryDate: expiry,
        message: tenant.plan === 'trial'
          ? 'Your free trial has ended. Please upgrade to continue making changes.'
          : 'Your subscription has expired. Please renew to continue making changes.',
      });
    }

    // Active subscription — attach info and continue.
    req.subscription = {
      plan: tenant.plan,
      status: tenant.status,
      expired: false,
      daysLeft: expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : 9999,
      expiryDate: expiry,
    };
    next();
  } catch (error) {
    console.error('[Subscription] Middleware error:', error.message);
    next();
  }
};

module.exports = enforceSubscription;
