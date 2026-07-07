const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Import with error handling
let getDashboardSummary;
try {
  const controller = require('../controllers/dashboardController');
  getDashboardSummary = controller.getDashboardSummary;
} catch (err) {
  console.error('[Dashboard] Controller load error:', err.message);
}

router.use(protect);

router.get('/summary', (req, res, next) => {
  if (!getDashboardSummary) {
    return res.status(500).json({ success: false, message: 'Dashboard controller not loaded.' });
  }
  return getDashboardSummary(req, res, next);
});

module.exports = router;