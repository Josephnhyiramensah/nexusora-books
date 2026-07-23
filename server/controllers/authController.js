// server/controllers/authController.js
// Handles user authentication within a tenant's database

const jwt = require('jsonwebtoken');
const { getModel } = require('../utils/getModel');
const { generateTokenPair, generateChallengeToken } = require('../utils/generateToken');
const { logAudit } = require('../middleware/auditMiddleware');

// Roles an administrator may assign via registration.
// 'super_admin' is deliberately EXCLUDED — it cannot be minted through this
// endpoint. Promote an existing user via Administration instead.
const ASSIGNABLE_ROLES = ['admin', 'accountant', 'staff', 'viewer'];

/**
 * POST /api/auth/register
 *
 * Two legitimate cases only:
 *   1. Tenant database is EMPTY → bootstrap the first user as super_admin.
 *   2. Tenant already has users → caller MUST be an authenticated admin.
 *
 * Anonymous registration into an existing workspace is rejected.
 * The role is NEVER taken on trust from an anonymous request body.
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phone } = req.body;
    const User = getModel(req.tenantDb, 'User');

    const userCount = await User.countDocuments();
    let assignedRole;

    if (userCount === 0) {
      // Bootstrap: brand-new tenant, no users yet.
      assignedRole = 'super_admin';
    } else {
      // Workspace already exists — an administrator must be doing this.
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Registration is closed for this organisation. Please contact your administrator.',
        });
      }

      if (!['super_admin', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can create new users.',
        });
      }

      const requested = String(role || 'staff').toLowerCase();
      if (!ASSIGNABLE_ROLES.includes(requested)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Allowed roles: ${ASSIGNABLE_ROLES.join(', ')}.`,
        });
      }

      assignedRole = requested;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: assignedRole,
      phone,
    });

    const { accessToken, refreshToken } = generateTokenPair(user, req.tenant.subdomain);

    user.refreshToken = refreshToken;
    await user.save();

    await logAudit(req.tenantDb, {
      userId: req.user ? req.user._id : user._id,
      action: 'create',
      module: 'auth',
      entityId: user._id,
      entityType: 'User',
      description: req.user
        ? `User created by ${req.user.email}: ${user.firstName} ${user.lastName} (${assignedRole})`
        : `Tenant bootstrapped — first user registered: ${user.firstName} ${user.lastName} (${assignedRole})`,
      newData: { email: user.email, role: assignedRole },
    }, req);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('[Auth] Register error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }
};

/**
 * POST /api/auth/login
 *
 * On a correct password, one of two outcomes:
 *   A. User has 2FA enabled → no session; return a 2fa_pending challenge. The
 *      client completes login at POST /api/auth/2fa/login.
 *   C. Otherwise            → full access/refresh session (as before). 2FA is
 *      OPTIONAL, so a user without it simply logs in. The response carries
 *      twoFactorEnabled:false so the client can show a (skippable) "set up 2FA"
 *      prompt and an off-by-default warning — that nudge is entirely frontend.
 *
 * In Case A the lockout counters are intentionally NOT cleared — they clear only
 * when a full session is issued (Case C here, or a successful second factor in
 * the 2fa/login handler), keeping the failed-attempt count continuous across both
 * factors and single-sourced.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact your administrator.',
      });
    }

    // Locked accounts are rejected before the password is even checked —
    // so an attacker learns nothing from timing.
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked after repeated failed logins. Try again in ${user.minutesUntilUnlock()} minute(s), or contact your administrator.`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const nowLocked = await user.registerFailedLogin();
      console.warn(`[Auth] Failed login: ${user.email} (${req.tenant?.subdomain}) from ${req.ip}${nowLocked ? ' — ACCOUNT LOCKED' : ''}`);

      if (nowLocked) {
        return res.status(423).json({
          success: false,
          message: `Too many failed attempts. Account locked for ${user.minutesUntilUnlock()} minute(s).`,
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ─── Password correct. ────────────────────────────────────────────────────

    // Case A: 2FA enabled → issue NO real tokens; require the second factor.
    if (user.twoFactorEnabled) {
      const challengeToken = generateChallengeToken(user, req.tenant.subdomain, '2fa_pending');
      return res.json({
        success: true,
        twoFactorRequired: true,
        message: 'Enter the code from your authenticator app to finish signing in.',
        data: { challengeToken },
      });
    }

    // Case C: no 2FA → full session, exactly as before. twoFactorEnabled:false is
    // surfaced so the client can offer a skippable "set up 2FA" prompt/banner.
    const { accessToken, refreshToken } = generateTokenPair(user, req.tenant.subdomain);

    user.refreshToken = refreshToken;
    await user.registerSuccessfulLogin(req.ip);
    await logAudit(req.tenantDb, {
      userId: user._id,
      action: 'login',
      module: 'auth',
      description: `User logged in: ${user.email}`,
    }, req);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
};

/**
 * POST /api/auth/refresh
 */
const refreshTokenHandler = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Cross-tenant assertion on refresh as well.
    if (decoded.tenantId && req.tenant && decoded.tenantId !== req.tenant.subdomain) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is not valid for this workspace.',
      });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated.',
      });
    }

    const tokens = generateTokenPair(user, req.tenant.subdomain);

    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Token refreshed.',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please log in again.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Token refresh failed.',
    });
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'logout',
      module: 'auth',
      description: `User logged out: ${req.user.email}`,
    }, req);

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Logout failed.' });
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          twoFactorEnabled: user.twoFactorEnabled,
          permissions: user.permissions || [],
          createdAt: user.createdAt,
        },
        tenant: req.tenant,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
};

/**
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters.',
      });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    user.password = newPassword;
    await user.save();

    await logAudit(req.tenantDb, {
      userId: user._id,
      action: 'update',
      module: 'auth',
      entityId: user._id,
      entityType: 'User',
      description: 'Password changed',
    }, req);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};

module.exports = {
  register,
  login,
  refreshToken: refreshTokenHandler,
  logout,
  getMe,
  changePassword,
};