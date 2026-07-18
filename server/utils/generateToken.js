// server/utils/generateToken.js
// JWT access + refresh token generation

const jwt = require('jsonwebtoken');

const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });
};

const generateTokenPair = (user, tenantId) => {
  const accessPayload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    tenantId,
  };

  const refreshPayload = {
    userId: user._id,
    email: user.email,
    tenantId,
  };

  return {
    accessToken: generateAccessToken(accessPayload),
    refreshToken: generateRefreshToken(refreshPayload),
  };
};

/**
 * Short-lived challenge token used BETWEEN the password step and the second-factor
 * step of login, for users who already have 2FA enabled.
 *
 * Signed with JWT_SECRET (same key as access tokens) and carries
 * tenantId = the tenant subdomain, so the existing cross-tenant assertion applies
 * to it for free. It is distinguished from a real access token ONLY by its `type`
 * claim — which is exactly why authMiddleware must reject ANY token carrying a
 * `type` (see the middleware hardening): a challenge token must never satisfy
 * `protect`.
 *
 *   type '2fa_pending' → password OK, awaiting TOTP / backup code   (~5 min)
 *
 * Payload is deliberately minimal (no role/email) — the 2FA handler re-fetches the
 * user fresh, so nothing sensitive needs to ride in the token.
 */
const CHALLENGE_TTL = {
  '2fa_pending': process.env.TWO_FA_PENDING_EXPIRE || '5m',
};

const generateChallengeToken = (user, tenantId, type) => {
  if (!CHALLENGE_TTL[type]) {
    throw new Error(`Unknown challenge token type: ${type}`);
  }
  return jwt.sign(
    { userId: user._id, tenantId, type },
    process.env.JWT_SECRET,
    { expiresIn: CHALLENGE_TTL[type] }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  generateChallengeToken,
};