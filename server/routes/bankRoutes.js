const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getBankAccounts, createBankAccount, updateBankAccount } = require('../controllers/bankController');

router.use(protect);
router.get('/', getBankAccounts);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createBankAccount);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateBankAccount);

module.exports = router;