// server/routes/ledgerRoutes.js
// Per-person subsidiary ledgers (Receivables / Payables by sign) and their
// running-balance statements of account. Same access rule as the reports —
// this is the same financial data, viewed per party.
const express = require('express');
const router = express.Router();
const { protect, allow, authorise } = require('../middleware/authMiddleware');
const { getPartyLedgers, getPartyStatement, createPartyLedger, updatePartyLedger } = require('../controllers/ledgerController');

router.use(protect);

// Reading — same access rule as the reports.
router.get('/parties', allow('reports.view', 'super_admin', 'admin', 'accountant'), getPartyLedgers);
router.get('/parties/:id/statement', allow('reports.view', 'super_admin', 'admin', 'accountant'), getPartyStatement);

// Writing — same roles that can manage the chart of accounts.
router.post('/parties', authorise('super_admin', 'admin', 'accountant'), createPartyLedger);
router.patch('/parties/:id', authorise('super_admin', 'admin', 'accountant'), updatePartyLedger);

module.exports = router;
