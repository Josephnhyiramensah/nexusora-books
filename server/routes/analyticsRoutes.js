// server/routes/analyticsRoutes.js
// Interactive financial dashboards (KPIs, ratios, time-series). Same access rule
// as the financial reports — this is the same financial data, differently shaped.
const express = require('express');
const router = express.Router();
const { protect, allow } = require('../middleware/authMiddleware');
const { getFinancialDashboard } = require('../controllers/financialAnalyticsController');

router.use(protect);
router.use(allow('reports.view', 'super_admin', 'admin', 'accountant'));

// GET /api/analytics/dashboard?type=financial&year=&quarter=
router.get('/dashboard', getFinancialDashboard);

module.exports = router;
