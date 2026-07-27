const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getBills, getBill, createBill, approveBill, deleteBill, confirmBill, rejectBill } = require('../controllers/billController');

router.use(protect);

router.get('/', getBills);
router.get('/:id', getBill);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createBill);
router.post('/:id/approve', authorise('super_admin', 'admin', 'accountant'), approveBill);
router.post('/:id/confirm', authorise('super_admin', 'admin'), confirmBill);
router.post('/:id/reject', authorise('super_admin', 'admin'), rejectBill);
router.delete('/:id', authorise('super_admin', 'admin'), deleteBill);

module.exports = router;