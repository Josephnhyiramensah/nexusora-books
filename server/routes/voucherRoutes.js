// server/routes/voucherRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getVouchers, getVoucher, createVoucher, updateVoucher, postVoucher, approveVoucher, rejectVoucher, reverseVoucher, deleteVoucher, addAttachment, removeAttachment } = require('../controllers/voucherController');

router.use(protect);

// Read: any finance role. Create/post: admin or accountant. Reverse: admin only.
// Matches the journal routes' role model (no separate permission key exists).
router.get('/', getVouchers);
router.get('/:id', getVoucher);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createVoucher);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateVoucher);
router.post('/:id/post', authorise('super_admin', 'admin', 'accountant'), postVoucher);
router.post('/:id/approve', authorise('super_admin', 'admin'), approveVoucher);
router.post('/:id/reject', authorise('super_admin', 'admin'), rejectVoucher);
router.post('/:id/reverse', authorise('super_admin', 'admin'), reverseVoucher);
router.delete('/:id', authorise('super_admin', 'admin', 'accountant'), deleteVoucher);

// Attachments (source documents) on a voucher.
router.post('/:id/attachments', authorise('super_admin', 'admin', 'accountant'), addAttachment);
router.delete('/:id/attachments/:attachmentId', authorise('super_admin', 'admin', 'accountant'), removeAttachment);

module.exports = router;
