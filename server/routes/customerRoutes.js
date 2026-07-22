const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getCustomers, getCustomer, createCustomer, updateCustomer, printStatement, toggleCustomerActive } = require('../controllers/customerController');
// Protected routes
router.use(protect);

// Customer statements contain financial data. This previously sat above
// router.use(protect) and was reachable with no authentication at all.
router.get('/:id/statement', authorise('super_admin', 'admin', 'accountant'), printStatement);

router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createCustomer);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateCustomer);
router.patch('/:id/toggle-active', authorise('super_admin', 'admin'), toggleCustomerActive);
module.exports = router;