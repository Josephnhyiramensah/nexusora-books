const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getTrialBalance, getProfitLoss, getBalanceSheet,
  getCashFlow, getGeneralLedger,
} = require('../controllers/reportController');

router.use(protect);

router.get('/trial-balance', getTrialBalance);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/cash-flow', getCashFlow);
router.get('/general-ledger', getGeneralLedger);

module.exports = router;


