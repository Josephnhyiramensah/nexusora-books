// server/controllers/twoFactorController.js
// Two-factor authentication (TOTP) enrolment, verification, and step-2 login.
//
// POLICY: 2FA is OPTIONAL for every role. There is no mandatory enrolment and no
// enrolment challenge token — a user enrols from a normal, already-authenticated
// session (they are logged in, click "set up 2FA"). The only challenge token in
// play is the short-lived 2fa_pending token issued BETWEEN the password step and
// the second-factor step, for users who already have 2FA enabled.
//
// req.user (from protect) is a SLIMMED PLAIN OBJECT, not a Mongoose doc, so every
// handler that mutates 2FA state re-fetches by req.user._id with an explicit
// .select() for the secret field it needs (all are select:false).

const jwt = require('jsonwebtoken');
const { getModel } = require('../utils/getModel');
const { generateTokenPair } = require('../utils/generateToken');
const { logAudit } = require('../middleware/auditMiddleware');
const {
  generateTotpSecret,
  buildOtpauthUri,
  generateQrDataUrl,
  verifyTotp,
  generateBackupCodes,
} = require('../utils/twoFactor');

/**
 * POST /api/auth/2fa/setup   (behind protect)
 *
 * Begins enrolment: generates a provisional secret, stores it in
 * twoFactorPendingSecret (NOT twoFactorSecret — a re-enrolment must not clobber
 * a working secret until confirmed), and returns the otpauth URI + QR data URL.
 * Idempotent: calling again issues a fresh pending secret, invalidating any
 * half-finished previous attempt.
 */
const setup = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.user._id).select('+twoFactorSecret +twoFactorPendingSecret');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const secret = generateTotpSecret();
    const otpauthUri = buildOtpauthUri(secret, user.email);
    const qrDataUrl = await generateQrDataUrl(otpauthUri);

    user.twoFactorPendingSecret = secret;
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: 'Scan the QR code with your authenticator app, then verify a code to finish setup.',
      data: {
        qrDataUrl,
        // Manual-entry fallback for users who cannot scan. This is the PENDING
        // secret only — it becomes active only once a code is verified.
        manualEntryKey: secret,
        alreadyEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error('[2FA] Setup error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to begin 2FA setup.' });
  }
};

/**
 * POST /api/auth/2fa/verify-setup   (behind protect)   body: { token }
 *
 * Confirms enrolment: verifies a 6-digit code against the PENDING secret. On
 * success, promotes pending → active, flips twoFactorEnabled, generates backup
 * codes, and returns them ONCE (never retrievable again).
 */
const verifySetup = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.user._id).select('+twoFactorPendingSecret +twoFactorBackupCodes');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!user.twoFactorPendingSecret) {
      return res.status(400).json({
        success: false,
        message: 'No pending 2FA setup found. Start setup again.',
      });
    }

    if (!verifyTotp(token, user.twoFactorPendingSecret)) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect code. Check your authenticator app and try again.',
      });
    }

    const { display, hashed } = await generateBackupCodes();

    user.twoFactorSecret = user.twoFactorPendingSecret;
    user.twoFactorPendingSecret = undefined;
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = hashed;
    await user.save({ validateBeforeSave: false });

    await logAudit(req.tenantDb, {
      userId: user._id,
      action: 'update',
      module: 'auth',
      entityId: user._id,
      entityType: 'User',
      description: `2FA enabled for ${user.email}`,
    }, req);

    return res.json({
      success: true,
      message: 'Two-factor authentication is now enabled. Save your backup codes.',
      data: {
        // Shown ONCE. The client must display and let the user save these now.
        backupCodes: display,
      },
    });
  } catch (error) {
    console.error('[2FA] Verify-setup error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to verify 2FA setup.' });
  }
};

/**
 * POST /api/auth/2fa/disable   (behind protect)   body: { password, token }
 *
 * Turns 2FA off. Requires BOTH current password and a valid current TOTP, so a
 * hijacked-but-unverified session cannot strip 2FA. Optional-for-all policy: no
 * role is prevented from disabling.
 */
const disable = async (req, res) => {
  try {
    const { password, token } = req.body;
    if (!password || !token) {
      return res.status(400).json({
        success: false,
        message: 'Password and a current authenticator code are both required to disable 2FA.',
      });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.user._id).select('+password +twoFactorSecret');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA is not currently enabled.' });
    }

    const passOk = await user.comparePassword(password);
    if (!passOk) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }
    if (!verifyTotp(token, user.twoFactorSecret)) {
      return res.status(401).json({ success: false, message: 'Incorrect authenticator code.' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorPendingSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    await user.save({ validateBeforeSave: false });

    await logAudit(req.tenantDb, {
      userId: user._id,
      action: 'update',
      module: 'auth',
      entityId: user._id,
      entityType: 'User',
      description: `2FA disabled for ${user.email}`,
    }, req);

    return res.json({ success: true, message: 'Two-factor authentication has been disabled.' });
  } catch (error) {
    console.error('[2FA] Disable error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to disable 2FA.' });
  }
};

/**
 * POST /api/auth/2fa/regenerate-backup-codes   (behind protect)   body: { token }
 *
 * Issues a fresh set of backup codes, invalidating all previous ones. Requires
 * a current TOTP so only the legitimate device-holder can rotate them.
 */
const regenerateBackupCodes = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'A current authenticator code is required.' });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.user._id).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA is not enabled.' });
    }
    if (!verifyTotp(token, user.twoFactorSecret)) {
      return res.status(401).json({ success: false, message: 'Incorrect authenticator code.' });
    }

    const { display, hashed } = await generateBackupCodes();
    user.twoFactorBackupCodes = hashed;
    await user.save({ validateBeforeSave: false });

    await logAudit(req.tenantDb, {
      userId: user._id,
      action: 'update',
      module: 'auth',
      entityId: user._id,
      entityType: 'User',
      description: `2FA backup codes regenerated for ${user.email}`,
    }, req);

    return res.json({
      success: true,
      message: 'New backup codes generated. Your previous codes no longer work.',
      data: { backupCodes: display },
    });
  } catch (error) {
    console.error('[2FA] Regenerate error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to regenerate backup codes.' });
  }
};

/**
 * POST /api/auth/2fa/login   (PUBLIC — no protect)   body: { challengeToken, token?, backupCode? }
 *
 * Step 2 of login, for users who ALREADY have 2FA enabled. The challengeToken is
 * the short-lived 2fa_pending token minted by the password step. Verifies EITHER
 * a TOTP (token) OR a single-use backupCode, then issues the real token pair.
 *
 * Verified inline here (not via middleware) because the user is not yet fully
 * authenticated. Wrong code → registerFailedLogin (shared lockout). Right code →
 * registerSuccessfulLogin + real tokens.
 */
const loginVerify = async (req, res) => {
  try {
    const { challengeToken, token, backupCode } = req.body;
    if (!challengeToken) {
      return res.status(400).json({ success: false, message: 'Login session expired. Please sign in again.' });
    }
    if (!token && !backupCode) {
      return res.status(400).json({ success: false, message: 'Enter an authenticator code or a backup code.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(challengeToken, process.env.JWT_SECRET);
    } catch (e) {
      const expired = e.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        message: expired ? 'Login session expired. Please sign in again.' : 'Invalid login session.',
      });
    }

    if (decoded.type !== '2fa_pending') {
      return res.status(401).json({ success: false, message: 'Invalid login session.' });
    }
    if (decoded.tenantId && req.tenant && decoded.tenantId !== req.tenant.subdomain) {
      return res.status(401).json({ success: false, message: 'Login session is not valid for this workspace.' });
    }

    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(decoded.userId).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated.' });
    }
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked. Try again in ${user.minutesUntilUnlock()} minute(s).`,
      });
    }
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: 'Two-factor authentication is not enabled for this account.' });
    }

    let verified = false;
    let usedBackup = false;
    if (token) {
      verified = verifyTotp(token, user.twoFactorSecret);
    }
    if (!verified && backupCode) {
      verified = await user.verifyAndBurnBackupCode(backupCode);
      usedBackup = verified;
    }

    if (!verified) {
      const nowLocked = await user.registerFailedLogin();
      console.warn(`[2FA] Failed second factor: ${user.email} (${req.tenant?.subdomain}) from ${req.ip}${nowLocked ? ' — ACCOUNT LOCKED' : ''}`);
      if (nowLocked) {
        return res.status(423).json({
          success: false,
          message: `Too many failed attempts. Account locked for ${user.minutesUntilUnlock()} minute(s).`,
        });
      }
      return res.status(401).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    const { accessToken, refreshToken } = generateTokenPair(user, req.tenant.subdomain);
    user.refreshToken = refreshToken;
    await user.registerSuccessfulLogin(req.ip);   // saves refreshToken too (same doc)

    await logAudit(req.tenantDb, {
      userId: user._id,
      action: 'login',
      module: 'auth',
      description: `User logged in (2FA${usedBackup ? ', backup code' : ''}): ${user.email}`,
    }, req);

    const backupCodesRemaining = Array.isArray(user.twoFactorBackupCodes)
      ? user.twoFactorBackupCodes.length
      : 0;

    return res.json({
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
        usedBackupCode: usedBackup,
        backupCodesRemaining,
      },
    });
  } catch (error) {
    console.error('[2FA] Login-verify error:', error.message);
    return res.status(500).json({ success: false, message: 'Second-factor verification failed.' });
  }
};

module.exports = {
  setup,
  verifySetup,
  disable,
  regenerateBackupCodes,
  loginVerify,
};