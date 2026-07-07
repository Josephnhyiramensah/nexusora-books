// server/middleware/authMiddleware.js
// JWT verification + role-based access control

const jwt = require('jsonwebtoken');
const { getModel } = require('../utils/getModel');

/**
 * Protect routes — verify JWT access token.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorised. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'User account has been deactivated.' });
    }

    req.user = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      fullName: `${user.firstName} ${user.lastName}`,
    };

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

module.exports = { protect, authorise };