const Tenant = require('../models/Tenant');
const { getTenantConnection } = require('../config/db');
const { getModel } = require('../utils/getModel');
const { defaultChartOfAccounts } = require('../config/seedData');
const { generateTokenPair } = require('../utils/generateToken');

// Pricing
const PRICING = {
  starter: { monthly: 300, semi_annual: 1500, annual: 2700, currency: 'GHS' },
  professional: { monthly: 990, semi_annual: 4950, annual: 8910, currency: 'GHS' },
  enterprise: { monthly: 2400, semi_annual: 12000, annual: 21600, currency: 'GHS' },
};

const provisionTenant = async (req, res) => {
  try {
    const { subdomain, companyName, plan, owner, settings, adminUser } = req.body;

    if (!subdomain || !companyName || !owner?.name || !owner?.email || !adminUser?.email || !adminUser?.password) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    if (adminUser.password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await Tenant.findOne({ subdomain: subdomain.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: `Subdomain "${subdomain}" is already taken.` });

    // Check email not already used as owner
    const emailUsed = await Tenant.findOne({ 'owner.email': owner.email.toLowerCase() });
    if (emailUsed) return res.status(409).json({ success: false, message: 'This email is already registered with another company.' });

    const tenant = await Tenant.create({
      subdomain: subdomain.toLowerCase(), companyName,
      plan: plan || 'trial',
      status: plan === 'founding' ? 'founding' : 'active',
      owner, settings: {
        fiscalYearStart: settings?.fiscalYearStart || 1,
        baseCurrency: settings?.baseCurrency || 'GHS',
        dateFormat: settings?.dateFormat || 'DD/MM/YYYY',
        address: settings?.address || '', city: settings?.city || '',
        region: settings?.region || '', taxId: settings?.taxId || '',
      },
    });

    const tenantDb = await getTenantConnection(tenant.databaseName);

    const Account = getModel(tenantDb, 'Account');
    await Account.insertMany(defaultChartOfAccounts.map((a) => ({ ...a, balance: 0 })));

    const User = getModel(tenantDb, 'User');
    const superAdmin = await User.create({
      firstName: adminUser.firstName || owner.name.split(' ')[0],
      lastName: adminUser.lastName || owner.name.split(' ').slice(1).join(' ') || 'Admin',
      email: adminUser.email, password: adminUser.password,
      role: 'super_admin', phone: adminUser.phone || owner.phone,
    });

    const { accessToken, refreshToken } = generateTokenPair(superAdmin, tenant.subdomain);
    superAdmin.refreshToken = refreshToken;
    await superAdmin.save();

    // Send welcome email (non-blocking)
    try {
      const { sendWelcomeEmail } = require('../utils/emailService');
      await sendWelcomeEmail({
        to: adminUser.email,
        companyName,
        subdomain: subdomain.toLowerCase(),
        adminName: `${adminUser.firstName || owner.name.split(' ')[0]}`,
        plan: plan || 'trial',
        expiryDate: tenant.subscription?.expiryDate,
      });
    } catch (emailErr) {
      console.warn('[Tenant] Welcome email failed (non-fatal):', emailErr.message);
    }

    res.status(201).json({
      success: true, message: 'Registration successful! Your company workspace is ready.',
      data: {
        tenant: {
          subdomain: tenant.subdomain, companyName: tenant.companyName,
          databaseName: tenant.databaseName, plan: tenant.plan, status: tenant.status,
          subscription: tenant.subscription,
        },
        user: { _id: superAdmin._id, firstName: superAdmin.firstName, lastName: superAdmin.lastName, email: superAdmin.email, role: superAdmin.role },
        accessToken, refreshToken,
        loginUrl: `https://${tenant.subdomain}.nexusorabooks.com`,
      },
    });
  } catch (error) {
    console.error('[Tenant] Provision error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map((e) => e.message).join('. ') });
    }
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

const listTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().select('-__v').sort({ createdAt: -1 });

    // Get user counts for each tenant
    const enriched = await Promise.all(tenants.map(async (t) => {
      try {
        const tenantDb = await getTenantConnection(t.databaseName);
        const User = getModel(tenantDb, 'User');
        const userCount = await User.countDocuments({});
        const activeUsers = await User.countDocuments({ isActive: true });
        return { ...t.toObject(), usage: { ...t.usage, currentUsers: activeUsers, totalUsers: userCount } };
      } catch {
        return { ...t.toObject() };
      }
    }));

    res.json({ success: true, data: enriched, count: enriched.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list tenants.' });
  }
};

const getTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });
    res.json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch tenant.' });
  }
};

/**
 * GET /api/tenants/:subdomain/public
 *
 * PUBLIC — unauthenticated. Used by the login page to render tenant branding.
 * Returns ONLY what the login screen needs. Never exposes owner details,
 * subscription terms, usage stats, or databaseName.
 */
const getTenantPublic = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain })
      .select('subdomain companyName plan status settings.whiteLabel settings.logo');

    if (!tenant || ['suspended', 'archived'].includes(tenant.status)) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    res.json({
      success: true,
      data: {
        subdomain: tenant.subdomain,
        companyName: tenant.companyName,
        plan: tenant.plan,
        settings: {
          whiteLabel: tenant.settings?.whiteLabel || {},
          logo: tenant.settings?.logo || '',
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch tenant.' });
  }
};

const updateTenantSettings = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const { settings } = req.body;
    if (settings) {
      const allowed = ['logo', 'address', 'city', 'region', 'country', 'taxId', 'letterhead', 'fiscalYearStart', 'baseCurrency', 'dateFormat',   'whiteLabel',];
      allowed.forEach((f) => { if (settings[f] !== undefined) tenant.settings[f] = settings[f]; });
      tenant.markModified('settings');
    }
   await tenant.save();

    res.json({ success: true, message: 'Settings updated.', data: tenant });
  } catch (error) {
    console.error('[Tenant] Settings update error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to update settings.' });
  }
};

// PUT /api/auth/company-settings   (protect + tenantMiddleware)
// TENANT-FACING settings save. Unlike updateTenantSettings (platform-console
// only), this saves settings for the CALLER'S OWN tenant — identified by
// req.tenant (resolved from the request host by tenantMiddleware), NEVER from a
// URL parameter. So a user logged into tenant A can only ever edit tenant A;
// there is no subdomain in the path to tamper with.
const updateMyTenantSettings = async (req, res) => {
 
  try {
    // req.tenant is set by tenantMiddleware from the host subdomain — trusted.
    const subdomain = req.tenant?.subdomain;
    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'No tenant context.' });
    }

    const tenant = await Tenant.findOne({ subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const { settings } = req.body;
    if (settings) {
      // Full whitelist matching the Tenant.settings schema, including
      // letterheadImage (which the platform route's list was missing).
      const allowed = [
        'logo', 'letterheadImage', 'address', 'city', 'region', 'taxId',
        'letterhead', 'fiscalYearStart', 'baseCurrency', 'dateFormat', 'whiteLabel',
      ];
      allowed.forEach((f) => { if (settings[f] !== undefined) tenant.settings[f] = settings[f]; });
      tenant.markModified('settings');
    }
    await tenant.save();

    res.json({ success: true, message: 'Settings updated.', data: { settings: tenant.settings } });
  } catch (error) {
    console.error('[Tenant] My-settings update error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to update settings.' });
  }
};

const getPricing = async (req, res) => {
  res.json({ success: true, data: PRICING });
};

const suspendTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });
    tenant.status = 'suspended';
    await tenant.save();
    res.json({ success: true, message: `Tenant ${tenant.subdomain} suspended.`, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to suspend tenant.' });
  }
};

const reactivateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });
    tenant.status = 'active';
    await tenant.save();
    res.json({ success: true, message: `Tenant ${tenant.subdomain} reactivated.`, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reactivate tenant.' });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments({});
    const activeTenants = await Tenant.countDocuments({ status: { $in: ['active', 'trial', 'founding'] } });
    const suspendedTenants = await Tenant.countDocuments({ status: 'suspended' });
    const trialTenants = await Tenant.countDocuments({ status: 'trial' });

    const byPlan = await Tenant.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    const recentTenants = await Tenant.find({}).sort({ createdAt: -1 }).limit(10)
      .select('subdomain companyName plan status createdAt subscription.expiryDate owner.email');

    res.json({
      success: true,
      data: {
        totalTenants, activeTenants, suspendedTenants, trialTenants,
        byPlan: byPlan.reduce((o, p) => { o[p._id] = p.count; return o; }, {}),
        recentTenants,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats.' });
  }
};



// ─── Get Tenant Users ─────────────────────────────────────────────────────────
// ─── Change Tenant Plan ───────────────────────────────────────────────────────
const changeTenantPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['trial', 'starter', 'professional', 'enterprise', 'founding'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ success: false, message: `Invalid plan. Must be one of: ${validPlans.join(', ')}` });
    }

    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const planLimits = {
      trial:        { maxUsers: 2,    maxAccountants: 1 },
      starter:      { maxUsers: 5,    maxAccountants: 2 },
      professional: { maxUsers: 20,   maxAccountants: 5 },
      enterprise:   { maxUsers: 9999, maxAccountants: 9999 },
      founding:     { maxUsers: 9999, maxAccountants: 9999 },
    };

    tenant.plan = plan;
    tenant.status = plan === 'founding' ? 'founding' : 'active';
    tenant.subscription = {
      ...tenant.subscription,
      plan,
      maxUsers: planLimits[plan].maxUsers,
      maxAccountants: planLimits[plan].maxAccountants,
    };

    await tenant.save();
    res.json({ success: true, message: `Plan changed to ${plan} for ${tenant.subdomain}.`, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change plan.' });
  }
};
const getTenantUsers = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });
    const tenantDb = await getTenantConnection(tenant.databaseName);
    const User = getModel(tenantDb, 'User');
    const users = await User.find({}).select('-password -refreshToken').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

// ─── Reset Tenant User Password ───────────────────────────────────────────────
const resetTenantUserPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const tenantDb = await getTenantConnection(tenant.databaseName);
    const User = getModel(tenantDb, 'User');
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: `No user found with email: ${email}` });

    user.password = newPassword; // bcrypt hash happens in pre-save hook
    await user.save();

    res.json({ success: true, message: `Password reset for ${email}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

// ─── Get Tenant Detail Stats ──────────────────────────────────────────────────
const getTenantDetailStats = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.params.subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const tenantDb = await getTenantConnection(tenant.databaseName);
    const User = getModel(tenantDb, 'User');

    const [totalUsers, activeUsers, lastLogin] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.findOne({}).sort({ lastLogin: -1 }).select('lastLogin email firstName lastName'),
    ]);

    // Count journal entries if model exists
    let journalCount = 0;
    let invoiceCount = 0;
    try {
      const JournalEntry = getModel(tenantDb, 'JournalEntry');
      const Invoice = getModel(tenantDb, 'Invoice');
      [journalCount, invoiceCount] = await Promise.all([
        JournalEntry.countDocuments({}),
        Invoice.countDocuments({}),
      ]);
    } catch {}

    res.json({
      success: true,
      data: {
        totalUsers, activeUsers, journalCount, invoiceCount,
        lastLogin: lastLogin ? { date: lastLogin.lastLogin, user: `${lastLogin.firstName} ${lastLogin.lastName}` } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch tenant stats.' });
  }
};
const deleteTenant = async (req, res) => {
  try {
    const { subdomain } = req.params;

    const tenant = await Tenant.findOne({ subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    if (tenant.plan === 'founding') {
      return res.status(403).json({ success: false, message: 'Cannot delete a founding tenant.' });
    }

    // Drop the tenant database
    try {
      const tenantConn = await getTenantConnection(tenant.databaseName);
      await tenantConn.db.dropDatabase();
      console.log(`[Tenant] Dropped database: ${tenant.databaseName}`);
    } catch (dbErr) {
      console.warn('[Tenant] Could not drop database:', dbErr.message);
    }

    // Delete master record
    await Tenant.findByIdAndDelete(tenant._id);
    console.log(`[Tenant] Deleted tenant: ${subdomain}`);

    res.json({ success: true, message: `Tenant "${subdomain}" and all their data have been permanently deleted.` });
  } catch (error) {
    console.error('[Tenant] Delete error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete tenant.' });
  }
};
// ─── OPERATOR CONSOLE: per-user controls (platformProtect only) ───────────────
// Called from the Master Admin console to fix a stuck tenant user. Identified by
// userId (from the Users table), so they keep working even while an email is
// being changed. The console is intentionally all-powerful here — the
// founding-account immutability rule lives on the TENANT side (Settings → Users),
// never here, so a founding account CAN be fully handed over (email + name +
// phone changed) from this console.
//
// NB: every save uses { validateBeforeSave: false } because the user is loaded
// WITHOUT the select:false password field; full validation would wrongly fail on
// "password required". Role and email are validated explicitly below instead.

const VALID_TENANT_ROLES = ['super_admin', 'admin', 'accountant', 'staff', 'viewer'];

// Shared: resolve tenant → its User model → the target user by id.
const resolveTenantUser = async (subdomain, userId) => {
  const tenant = await Tenant.findOne({ subdomain });
  if (!tenant) return { error: { status: 404, message: 'Tenant not found.' } };
  const tenantDb = await getTenantConnection(tenant.databaseName);
  const User = getModel(tenantDb, 'User');
  const user = await User.findById(userId);
  if (!user) return { error: { status: 404, message: 'User not found in this tenant.' } };
  return { tenant, User, user };
};

// POST /:subdomain/users/:userId/unlock
// Clears the FULL progressive-lockout state — a deliberate operator override.
const unlockTenantUser = async (req, res) => {
  try {
    const { user, error } = await resolveTenantUser(req.params.subdomain, req.params.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    user.failedLoginAttempts = 0;
    user.lockoutCount = 0;
    user.lockedUntil = null;
    await user.save({ validateBeforeSave: false });

    console.log(`[Console] Unlocked ${user.email} in ${req.params.subdomain} by ${req.platformAdmin?.email}`);
    res.json({ success: true, message: `${user.email} unlocked.`, data: { _id: user._id } });
  } catch (error) {
    console.error('[Console] Unlock error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to unlock user.' });
  }
};

// PUT /:subdomain/users/:userId/role   body: { role }
const changeTenantUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!VALID_TENANT_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${VALID_TENANT_ROLES.join(', ')}.` });
    }

    const { user, error } = await resolveTenantUser(req.params.subdomain, req.params.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const previous = user.role;
    user.role = role;
    await user.save({ validateBeforeSave: false });

    console.log(`[Console] Role ${previous} → ${role} for ${user.email} in ${req.params.subdomain} by ${req.platformAdmin?.email}`);
    res.json({ success: true, message: `${user.email} is now ${role.replace('_', ' ')}.`, data: { _id: user._id, role: user.role } });
  } catch (error) {
    console.error('[Console] Role change error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to change role.' });
  }
};

// PUT /:subdomain/users/:userId/identity   body: { email?, firstName?, lastName?, phone? }
// The handover control — replaces a founding/test account's details with the
// real owner's. Only the fields provided are changed.
const changeTenantUserIdentity = async (req, res) => {
  try {
    const { email, firstName, lastName, phone } = req.body;
    if (!email && firstName === undefined && lastName === undefined && phone === undefined) {
      return res.status(400).json({ success: false, message: 'Provide at least one field to change.' });
    }

    const { User, user, error } = await resolveTenantUser(req.params.subdomain, req.params.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    if (email) {
      const normalized = email.toLowerCase().trim();
      if (!/^\S+@\S+\.\S+$/.test(normalized)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email.' });
      }
      const clash = await User.findOne({ email: normalized, _id: { $ne: user._id } });
      if (clash) {
        return res.status(409).json({ success: false, message: 'Another user in this tenant already uses that email.' });
      }
      user.email = normalized;
    }
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;

    await user.save({ validateBeforeSave: false });

    console.log(`[Console] Identity updated for ${user._id} (${user.email}) in ${req.params.subdomain} by ${req.platformAdmin?.email}`);
    res.json({
      success: true,
      message: 'User details updated.',
      data: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
    });
  } catch (error) {
    console.error('[Console] Identity change error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update user details.' });
  }
};

// PUT /:subdomain/users/:userId/active   body: { isActive }
const setTenantUserActive = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be true or false.' });
    }

    const { user, error } = await resolveTenantUser(req.params.subdomain, req.params.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    user.isActive = isActive;
    await user.save({ validateBeforeSave: false });

    console.log(`[Console] ${isActive ? 'Activated' : 'Deactivated'} ${user.email} in ${req.params.subdomain} by ${req.platformAdmin?.email}`);
    res.json({ success: true, message: `${user.email} ${isActive ? 'activated' : 'deactivated'}.`, data: { _id: user._id, isActive: user.isActive } });
  } catch (error) {
    console.error('[Console] Active toggle error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update account status.' });
  }
};

module.exports = {
  provisionTenant,
  listTenants,
  getTenant,
  getTenantPublic,
  getAdminStats,
  suspendTenant,
  reactivateTenant,
  getPricing,
  updateTenantSettings,
  updateMyTenantSettings,
  changeTenantPlan,
  getTenantUsers,
  resetTenantUserPassword,
  getTenantDetailStats,
  deleteTenant,
  unlockTenantUser,
  changeTenantUserRole,
  changeTenantUserIdentity,
  setTenantUserActive,
};