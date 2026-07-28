// server/routes/currencyRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getRates, setManualRate, fetchLiveRates } = require('../controllers/currencyController');

router.use(protect);
router.get('/rates', getRates);
router.post('/rates/manual', authorise('super_admin', 'admin', 'accountant'), setManualRate);
router.post('/rates/fetch', authorise('super_admin', 'admin', 'accountant'), fetchLiveRates);

module.exports = router;
