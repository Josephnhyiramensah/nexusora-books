// server/routes/platformAuthRoutes.js
// Authentication for Nexusora platform administrators.
// NOTE: These routes must NOT pass through tenantMiddleware — a platform admin
// logs in at the apex domain, where no tenant exists.

const express = require('express');
const router = express.Router();
const { platformLogin, platformMe } = require('../controllers/platformAuthController');
const { platformProtect } = require('../middleware/platformMiddleware');

router.post('/login', platformLogin);
router.get('/me', platformProtect, platformMe);

module.exports = router;