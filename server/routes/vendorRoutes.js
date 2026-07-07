const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getVendors, getVendor, createVendor, updateVendor, deactivateVendor } = require('../controllers/vendorController');

router.use(protect);
router.get('/', getVendors);
router.get('/:id', getVendor);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createVendor);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateVendor);
router.delete('/:id', authorise('super_admin', 'admin'), deactivateVendor);

module.exports = router;