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

module.exports = { generateAccessToken, generateRefreshToken, generateTokenPair };