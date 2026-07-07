const express = require('express');
const router = express.Router();
const {
  getPublicSettings,
  getAdminSettings,
  updateSettings,
} = require('../controllers/platformSettingsController');

// Public — RegisterPage and frontend use this
router.get('/settings', getPublicSettings);

// Master admin protected routes
router.get('/settings/admin', getAdminSettings);
router.put('/settings', updateSettings);

module.exports = router;