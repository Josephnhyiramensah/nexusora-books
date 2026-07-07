const Tenant = require('../models/Tenant');

const enforceSubscription = async (req, res, next) => {
  try {
    if (!req.tenant) return next();

    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    if (tenant.plan === 'founding' || tenant.status === 'founding') return next();
    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'SUSPENDED',
        message: 'Your account has been suspended. Please contact support at support@nexusorabooks.com.',
      });
    }

    const now = new Date();
    const expiry = tenant.subscription?.expiryDate ? new Date(tenant.subscription.expiryDate) : null;

    if (expiry && now > expiry) {
      tenant.status = 'expired';
      await tenant.save();

      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        plan: tenant.plan,
        expiryDate: expiry,
        message: tenant.plan === 'trial'
          ? 'Your 14-day free trial has ended. Please upgrade to continue.'
          : 'Your subscription has expired. Please renew to continue.',
      });
    }

    // Attach subscription info to request
    req.subscription = {
      plan: tenant.plan,
      status: tenant.status,
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