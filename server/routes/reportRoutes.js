const express = require('express');
const router = express.Router();
const { protect, allow } = require('../middleware/authMiddleware');
const {
  getTrialBalance, getProfitLoss, getBalanceSheet,
  getCashFlow, getGeneralLedger,
} = require('../controllers/reportController');

router.use(protect);

// Single-account drilldown: used by the Assets/Liabilities/Equity/Revenue/
// Expenses pages when a user clicks an account. Any logged-in user (incl.
// viewer/staff) may view a single account's transactions. Guarded so it only
// works WITH an accountId — without one it would return the full ledger.
router.get('/general-ledger', (req, res, next) => {
  if (req.query.accountId) return next();
  return authorise('super_admin', 'admin', 'accountant')(req, res, next);
}, getGeneralLedger);

// Company-wide financial statements — finance roles only.
router.use(allow('reports.view', 'super_admin', 'admin', 'accountant'));

router.get('/trial-balance', getTrialBalance);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/cash-flow', getCashFlow);

module.exports = router;


