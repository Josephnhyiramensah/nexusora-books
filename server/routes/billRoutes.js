const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getBills, getBill, createBill, approveBill, deleteBill } = require('../controllers/billController');

router.use(protect);

router.get('/', getBills);
router.get('/:id', getBill);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createBill);
router.post('/:id/approve', authorise('super_admin', 'admin', 'accountant'), approveBill);
router.delete('/:id', authorise('super_admin', 'admin'), deleteBill);

module.exports = router;