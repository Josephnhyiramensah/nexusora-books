const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { PERMISSION_KEYS } = require('../config/permissions');

const getUsers = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const users = await User.find({}).select('-password -refreshToken -twoFactorSecret').sort({ createdAt: -1 }).lean();
    const now = Date.now();
    const withLockStatus = users.map((u) => ({
      ...u,
      isLocked: !!(u.lockedUntil && new Date(u.lockedUntil).getTime() > now),
    }));
    res.json({ success: true, data: withLockStatus, count: withLockStatus.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

const createUser = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const Tenant = require('../models/Tenant');

    const { firstName, lastName, email, password, role, phone } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, and password required.' });
    }

    // Check user limit
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    const currentCount = await User.countDocuments({ isActive: true });
    if (tenant && tenant.subscription?.maxUsers && currentCount >= tenant.subscription.maxUsers) {
      return res.status(403).json({
        success: false,
        message: `User limit reached (${tenant.subscription.maxUsers} for ${tenant.plan} plan). Upgrade your plan to add more users.`,
      });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use.' });

    const user = await User.create({
      firstName, lastName, email, password,
      role: role || 'staff', phone,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'settings',
      entityId: user._id, entityType: 'User',
      description: `Created user: ${firstName} ${lastName} (${role || 'staff'})`,
    }, req);

    res.status(201).json({
      success: true,
      message: `User ${firstName} ${lastName} created. They can log in with email: ${email}`,
      data: { _id: user._id, firstName, lastName, email, role: user.role },
    });
  } catch (error) {
    console.error('[Users] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
};

// The founding account = the oldest user in the tenant (earliest createdAt).
// It is IMMUTABLE from within the tenant app: no tenant admin may change its
// role, demote it, or deactivate it. (The platform console CAN edit it — that
// path lives in tenantController and is intentionally exempt from this guard.)
// Returns the founding user's _id as a string, or null if the tenant is empty.
const getFoundingUserId = async (User) => {
  const founder = await User.findOne({}).sort({ createdAt: 1 }).select('_id').lean();
  return founder ? String(founder._id) : null;
};

// Roles a TENANT admin may assign. super_admin is deliberately excluded — it can
// only be granted from the platform console, never from inside the tenant app.
const TENANT_ASSIGNABLE_ROLES = ['admin', 'accountant', 'staff', 'viewer'];

const updateUser = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const foundingId = await getFoundingUserId(User);
    const isFounder = foundingId && String(user._id) === foundingId;

    // A role change is being requested if `role` is present and differs.
    const roleChangeRequested = req.body.role !== undefined && req.body.role !== user.role;

    if (roleChangeRequested) {
      // Nobody may assign super_admin from inside the tenant app.
      if (req.body.role === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'The super admin role can only be assigned from the Nexusora console. Contact your provider.',
        });
      }
      // The founding account's role is immutable here.
      if (isFounder) {
        return res.status(403).json({
          success: false,
          message: 'The founding account cannot be changed from within the app. Contact your provider to hand it over.',
        });
      }
      // Any other requested role must be one a tenant admin is allowed to assign.
      if (!TENANT_ASSIGNABLE_ROLES.includes(req.body.role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Allowed: ${TENANT_ASSIGNABLE_ROLES.join(', ')}.`,
        });
      }
    }

    // Name/phone edits are always fine; role only reaches here if it passed above.
    const fields = ['firstName', 'lastName', 'phone', 'role'];
    fields.forEach((f) => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
    await user.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'settings',
      entityId: user._id, entityType: 'User',
      description: `Updated user: ${user.email}${roleChangeRequested ? ` (role → ${req.body.role})` : ''}`,
    }, req);

    res.json({ success: true, message: 'User updated.', data: user });
  } catch (error) {
    console.error('[Users] Update error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
};

const deactivateUser = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Founder-based (not role-based) immutability: only the founding account is
    // protected. A promoted super_admin can still be deactivated. This matches
    // the console's handover model — the founder is sacred inside the app, but
    // editable from the platform console.
    const foundingId = await getFoundingUserId(User);
    if (foundingId && String(user._id) === foundingId) {
      return res.status(400).json({ success: false, message: 'The founding account cannot be deactivated from within the app.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

/**
 * POST /api/users/:id/unlock
 * Release an account locked by failed login attempts.
 * Admin-only (enforced by the router).
 */
const unlockUser = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.isLocked()) {
      return res.status(400).json({ success: false, message: 'This account is not locked.' });
    }

    user.lockedUntil = null;
    user.failedLoginAttempts = 0;
    await user.save({ validateBeforeSave: false });

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'update',
      module: 'users',
      entityId: user._id,
      entityType: 'User',
      description: `Account unlocked by ${req.user.email}: ${user.email}`,
    }, req);

    console.log(`[Users] ${user.email} unlocked by ${req.user.email} (${req.tenant?.subdomain})`);

    res.json({ success: true, message: `${user.firstName} ${user.lastName} has been unlocked.` });
  } catch (error) {
    console.error('[Users] Unlock error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to unlock user.' });
  }
};

/**
 * PUT /api/users/:id/permissions   body: { permissions: [key] }
 *
 * Replaces a user's explicit grants. Grants are additive only — they never
 * remove access a role already implies — so revoking simply omits the key.
 * Admin-only (enforced on the route) and always audited, since this changes
 * who can see financial data.
 */
const updatePermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'permissions must be an array.' });
    }

    const invalid = permissions.filter((p) => !PERMISSION_KEYS.includes(p));
    if (invalid.length) {
      return res.status(400).json({ success: false, message: `Unknown permission(s): ${invalid.join(', ')}.` });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const previous = [...(user.permissions || [])];
    user.permissions = permissions;
    await user.save({ validateBeforeSave: false });

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'update',
      module: 'settings',
      entityId: user._id,
      entityType: 'User',
      description: `Permissions updated for ${user.email}: ${permissions.length ? permissions.join(', ') : 'none'}`,
      previousData: { permissions: previous },
      newData: { permissions },
    }, req);

    res.json({ success: true, message: 'Permissions updated.', data: { _id: user._id, permissions: user.permissions } });
  } catch (error) {
    console.error('[Users] Permissions update error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update permissions.' });
  }
};

module.exports = { getUsers, createUser, updateUser, deactivateUser, unlockUser, updatePermissions };