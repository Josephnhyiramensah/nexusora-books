// server/middleware/authMiddleware.js
// JWT verification + role-based access control

const jwt = require('jsonwebtoken');
const { getModel } = require('../utils/getModel');

/**
 * Shared token → user resolution.
 * Returns { user } on success, or { error: {status, message} } on failure.
 */
const resolveUserFromToken = async (req, token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Typed-token rejection: real access tokens carry NO `type` claim. Challenge
  // tokens (e.g. 2fa_pending, issued after the password step but before the
  // second factor) DO carry a `type`, and are signed with this same secret. If we
  // let one satisfy `protect`, a user could skip 2FA entirely by presenting their
  // pending token as a Bearer token. So any token with a `type` claim is refused
  // here — it must go only to its dedicated handler (e.g. POST /auth/2fa/login).
  if (decoded.type) {
    return { error: { status: 401, message: 'This token cannot be used to access resources.' } };
  }

  // Cross-tenant assertion: a token issued for tenant A must never be
  // accepted against tenant B, regardless of the X-Tenant-ID header.
if (decoded.tenantId && req.tenant && decoded.tenantId !== req.tenant.subdomain) {
      return { error: { status: 401, message: 'Token is not valid for this workspace.' } };
  }

  const User = getModel(req.tenantDb, 'User');
  const user = await User.findById(decoded.userId);

  if (!user) {
    return { error: { status: 401, message: 'User no longer exists.' } };
  }
  if (!user.isActive) {
    return { error: { status: 403, message: 'User account has been deactivated.' } };
  }

  return {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      fullName: `${user.firstName} ${user.lastName}`,
    },
  };
};

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

/**
 * Protect routes — verify JWT access token. Rejects anonymous callers.
 */
const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorised. No token provided.',
      });
    }

    const { user, error } = await resolveUserFromToken(req, token);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please refresh your session.' });
    }
    console.error('[AuthMiddleware] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
};

/**
 * Optional auth — populates req.user IF a valid token is supplied,
 * otherwise leaves req.user undefined and continues.
 *
 * Used on /auth/register, which must serve BOTH the very first user of a new
 * tenant (anonymous, no token) AND an existing admin creating a colleague.
 * The route handler is responsible for enforcing which case is permitted.
 */
const optionalProtect = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const { user } = await resolveUserFromToken(req, token);
    if (user) req.user = user;

    return next();
  } catch (error) {
    // Invalid/expired token on an optional route → treat as anonymous.
    return next();
  }
};

/**
 * Restrict access to specific roles.
 * Usage: authorise('super_admin', 'admin')
 */
const authorise = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
};

module.exports = { protect, optionalProtect, authorise };