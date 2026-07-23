const express = require('express');
const router = express.Router();
const { protect, authorise, allow } = require('../middleware/authMiddleware');
const { getBankAccounts, createBankAccount, updateBankAccount } = require('../controllers/bankController');

router.use(protect);
// Banking data is finance-only. The stricter per-route checks below still apply
// on top of this for writes.
router.use(allow('banking.view', 'super_admin', 'admin', 'accountant'));

router.get('/', getBankAccounts);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createBankAccount);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateBankAccount);

module.exports = router;