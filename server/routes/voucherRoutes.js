// server/routes/voucherRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getVouchers, getVoucher, createVoucher, postVoucher, reverseVoucher, deleteVoucher,
} = require('../controllers/voucherController');

router.use(protect);

// Read: any finance role. Create/post: admin or accountant. Reverse: admin only.
// Matches the journal routes' role model (no separate permission key exists).
router.get('/', getVouchers);
router.get('/:id', getVoucher);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createVoucher);
router.post('/:id/post', authorise('super_admin', 'admin', 'accountant'), postVoucher);
router.post('/:id/reverse', authorise('super_admin', 'admin'), reverseVoucher);
router.delete('/:id', authorise('super_admin', 'admin', 'accountant'), deleteVoucher);

module.exports = router;
