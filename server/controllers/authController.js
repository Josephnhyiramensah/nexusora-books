// server/controllers/authController.js
// Handles user authentication within a tenant's database

const jwt = require('jsonwebtoken');
const { getModel } = require('../utils/getModel');
const { generateTokenPair } = require('../utils/generateToken');
const { logAudit } = require('../middleware/auditMiddleware');

/**
 * POST /api/auth/register
 * Register first user (super_admin) or additional users (admin-only).
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phone } = req.body;
    const User = getModel(req.tenantDb, 'User');

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    // First user is always super_admin
    const userCount = await User.countDocuments();
    const assignedRole = userCount === 0 ? 'super_admin' : (role || 'staff');

    // Only super_admin/admin can create users after the first
    if (userCount > 0 && req.user) {
      if (!['super_admin', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can create new users.',
        });
      }
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
      userId: user._id,
      action: 'create',
      module: 'auth',
      entityId: user._id,
      entityType: 'User',
      description: `User registered: ${user.firstName} ${user.lastName} (${assignedRole})`,
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

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const { accessToken, refreshToken } = generateTokenPair(user, req.tenant.subdomain);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

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