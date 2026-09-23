const express = require('express');
const router = express.Router();
const { protect, allow } = require('../middleware/authMiddleware');
const {
  getTrialBalance, getProfitLoss, getBalanceSheet,
  getCashFlow, getGeneralLedger,
} = require('../controllers/reportController');

router.use(protect);

// Financial statements: finance roles, OR any user explicitly granted
// 'reports.view' by their administrator.
router.use(allow('reports.view', 'super_admin', 'admin', 'accountant'));

router.get('/trial-balance', getTrialBalance);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/cash-flow', getCashFlow);
router.get('/general-ledger', getGeneralLedger);

module.exports = router;