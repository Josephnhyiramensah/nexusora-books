// server/middleware/platformMiddleware.js
// Guards platform-level routes (tenant administration).
//
// SECURITY: uses a SEPARATE secret (PLATFORM_JWT_SECRET) and requires a
// type:'platform' claim. A tenant user's token — even a super_admin of KGR —
// is signed with JWT_SECRET and can NEVER satisfy this guard. This is what
// stops one client from administering another client's workspace.

const jwt = require('jsonwebtoken');
const PlatformAdmin = require('../models/PlatformAdmin');

const platformProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Platform authentication required.' });
    }

    const decoded = jwt.verify(token, process.env.PLATFORM_JWT_SECRET);

    if (decoded.type !== 'platform') {
      return res.status(403).json({ success: false, message: 'Not a platform token.' });
    }

    const admin = await PlatformAdmin.findById(decoded.adminId);

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Platform account not found or deactivated.' });
    }

    req.platformAdmin = {
      _id: admin._id,
      email: admin.email,
      role: admin.role,
      fullName: `${admin.firstName} ${admin.lastName}`,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Platform session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid platform token.' });
  }
};

/** Restrict to platform_owner only — for destructive actions like tenant deletion. */
const platformOwnerOnly = (req, res, next) => {
  if (!req.platformAdmin) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  if (req.platformAdmin.role !== 'platform_owner') {
    return res.status(403).json({ success: false, message: 'This action requires platform owner privileges.' });
  }
  next();
};

module.exports = { platformProtect, platformOwnerOnly };