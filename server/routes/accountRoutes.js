// server/routes/accountRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getAccounts, getAccountTree, getAccount,
  createAccount, updateAccount, deactivateAccount,
} = require('../controllers/accountController');

router.use(protect);

router.get('/', getAccounts);
router.get('/tree', getAccountTree);
router.get('/:id', getAccount);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createAccount);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateAccount);
router.patch('/:id/deactivate', authorise('super_admin', 'admin'), deactivateAccount);

module.exports = router;