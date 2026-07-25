const express = require('express');
const router = express.Router();
const { protect, allow, authorise } = require('../middleware/authMiddleware');
const {
  importStatement, getSessions, getSession, deleteSession,
} = require('../controllers/reconciliationController');

router.use(protect);
// Reconciliation lives under banking.view — the permission's own description
// already reads "Bank accounts and reconciliation".
router.use(allow('banking.view', 'super_admin', 'admin', 'accountant'));

router.get('/', getSessions);
router.get('/:id', getSession);
router.post('/import', authorise('super_admin', 'admin', 'accountant'), importStatement);
router.delete('/:id', authorise('super_admin', 'admin', 'accountant'), deleteSession);

module.exports = router;
