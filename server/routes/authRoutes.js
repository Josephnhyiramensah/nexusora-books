// server/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const {
  register, login, refreshToken, logout, getMe, changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes (tenant context required, but no auth)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;