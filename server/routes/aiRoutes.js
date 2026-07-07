const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  chat, generateReport, detectAnomalies, categoriseTransaction, forecastCashFlow,
} = require('../controllers/aiController');

router.use(protect);

router.post('/chat', chat);
router.post('/generate-report', generateReport);
router.post('/anomaly-detection', detectAnomalies);
router.post('/categorise', categoriseTransaction);
router.post('/cash-flow-forecast', forecastCashFlow);

module.exports = router;