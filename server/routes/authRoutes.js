// server/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const {
  register, login, refreshToken, logout, getMe, changePassword,
} = require('../controllers/authController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

// Registration is PUBLIC only for the first user of an empty tenant.
// optionalProtect populates req.user when an admin token is supplied, so the
// controller can reject anonymous registration into an existing workspace.
router.post('/register', optionalProtect, register);

router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;