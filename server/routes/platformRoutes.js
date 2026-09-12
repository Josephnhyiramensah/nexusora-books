const express = require('express');
const router = express.Router();
const {
  getPublicSettings,
  getAdminSettings,
  updateSettings,
} = require('../controllers/platformSettingsController');
const { platformProtect } = require('../middleware/platformMiddleware');
const { syncAllTenantsChart } = require('../controllers/chartSyncController');

// Public -- RegisterPage and the pricing table read this. Safe subset only.
router.get('/settings', getPublicSettings);

// --- PLATFORM ADMIN ONLY ---------------------------------------------------
// These two previously carried NO middleware despite a comment saying they did:
// GET exposed full admin settings and PUT let anyone overwrite them.
router.use(platformProtect);

router.get('/settings/admin', getAdminSettings);
router.put('/settings', updateSettings);

// Sync the chart of accounts across ALL tenants (additive, safe). Master only.
router.post('/sync-chart-all', syncAllTenantsChart);

module.exports = router;
