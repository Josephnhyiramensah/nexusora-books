// server/controllers/platformAuthController.js
// Login for Nexusora platform administrators.

const jwt = require('jsonwebtoken');
const PlatformAdmin = require('../models/PlatformAdmin');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const platformLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const admin = await PlatformAdmin.findOne({ email: String(email).toLowerCase() }).select('+password');

    // Same message for unknown email and wrong password — don't reveal which.
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (admin.isLocked()) {
      const mins = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked due to failed login attempts. Try again in ${mins} minute(s).`,
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated.' });
    }

    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= MAX_ATTEMPTS) {
        admin.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        admin.failedLoginAttempts = 0;
      }
      await admin.save();
      console.warn(`[Platform] Failed login: ${admin.email} from ${req.ip}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    admin.failedLoginAttempts = 0;
    admin.lockedUntil = undefined;
    admin.lastLogin = new Date();
    await admin.save();

    const accessToken = jwt.sign(
      { adminId: admin._id, email: admin.email, role: admin.role, type: 'platform' },
      process.env.PLATFORM_JWT_SECRET,
      { expiresIn: '2h' }
    );

    console.log(`[Platform] Login: ${admin.email} from ${req.ip}`);

    res.json({
      success: true,
      message: 'Platform login successful.',
      data: {
        admin: {
          _id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role,
        },
        accessToken,
      },
    });
  } catch (error) {
    console.error('[Platform] Login error:', error.message);
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
};

const platformMe = async (req, res) => {
  res.json({ success: true, data: req.platformAdmin });
};

module.exports = { platformLogin, platformMe };