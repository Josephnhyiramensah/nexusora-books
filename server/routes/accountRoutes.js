// server/routes/accountRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getAccounts, getAccountTree, getAccount,
  createAccount, updateAccount, deactivateAccount,
  getSpecialAccounts, setSpecialAccounts,
} = require('../controllers/accountController');
const { syncMyChart } = require('../controllers/chartSyncController');

router.use(protect);

router.get('/', getAccounts);
router.get('/tree', getAccountTree);

// Special-account mappings (posting role -> chart code). MUST be declared before
// the '/:id' route below, or Express matches 'special-accounts' as an account id.
router.get('/special-accounts', getSpecialAccounts);
router.put('/special-accounts', authorise('super_admin', 'admin'), setSpecialAccounts);

router.get('/:id', getAccount);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createAccount);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateAccount);
router.patch('/:id/deactivate', authorise('super_admin', 'admin'), deactivateAccount);

// Top up this tenant's chart to the latest professional default (additive, safe).
router.post('/sync-chart', authorise('super_admin', 'admin'), syncMyChart);

module.exports = router;