// server/routes/ledgerRoutes.js
// Per-person subsidiary ledgers (Receivables / Payables by sign) and their
// running-balance statements of account. Same access rule as the reports —
// this is the same financial data, viewed per party.
const express = require('express');
const router = express.Router();
const { protect, allow } = require('../middleware/authMiddleware');
const { getPartyLedgers, getPartyStatement } = require('../controllers/ledgerController');

router.use(protect);
router.use(allow('reports.view', 'super_admin', 'admin', 'accountant'));

// GET /api/ledgers/parties?q=
router.get('/parties', getPartyLedgers);
// GET /api/ledgers/parties/:id/statement?startDate=&endDate=
router.get('/parties/:id/statement', getPartyStatement);

module.exports = router;
