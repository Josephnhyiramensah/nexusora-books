const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getTrialBalance, getProfitLoss, getBalanceSheet,
  getCashFlow, getGeneralLedger,
} = require('../controllers/reportController');

router.use(protect);
// Financial statements are restricted: viewers and general staff should not see
// company-wide P&L, balance sheet or ledger. Matches the frontend route gate.
router.use(authorise('super_admin', 'admin', 'accountant'));

router.get('/trial-balance', getTrialBalance);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/cash-flow', getCashFlow);
router.get('/general-ledger', getGeneralLedger);

module.exports = router;


