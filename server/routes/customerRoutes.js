const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getCustomers, getCustomer, createCustomer, updateCustomer, printStatement, toggleCustomerActive } = require('../controllers/customerController');
// Public within tenant — no JWT needed, just tenant middleware
router.get('/:id/statement', printStatement);

// Protected routes
router.use(protect);
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createCustomer);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateCustomer);
router.patch('/:id/toggle-active', authorise('super_admin', 'admin'), toggleCustomerActive);
module.exports = router;