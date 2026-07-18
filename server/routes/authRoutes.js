// server/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const {
  register, login, refreshToken, logout, getMe, changePassword,
} = require('../controllers/authController');
const {
  setup, verifySetup, disable, regenerateBackupCodes, loginVerify,
} = require('../controllers/twoFactorController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

// Registration is PUBLIC only for the first user of an empty tenant.
// optionalProtect populates req.user when an admin token is supplied, so the
// controller can reject anonymous registration into an existing workspace.
router.post('/register', optionalProtect, register);

router.post('/login', login);
router.post('/refresh', refreshToken);

// 2FA login step 2 — PUBLIC (the user is mid-login, not yet authenticated).
// Verifies the 2fa_pending challenge token + TOTP/backup code inline.
router.post('/2fa/login', loginVerify);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

// 2FA enrolment & management — behind protect (user is already logged in).
router.post('/2fa/setup', protect, setup);
router.post('/2fa/verify-setup', protect, verifySetup);
router.post('/2fa/disable', protect, disable);
router.post('/2fa/regenerate-backup-codes', protect, regenerateBackupCodes);

module.exports = router;