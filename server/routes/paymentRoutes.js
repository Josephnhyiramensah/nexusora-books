// server/routes/paymentRoutes.js
// Accounting payments — receive from customers, pay to vendors

const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getPayments,
  getPayment,
  receivePayment,
  makePayment,
} = require('../controllers/paymentController');

router.use(protect);

router.get('/', getPayments);
router.get('/:id', getPayment);
router.post('/receive', authorise('super_admin', 'admin', 'accountant'), receivePayment);
router.post('/make', authorise('super_admin', 'admin', 'accountant'), makePayment);

module.exports = router;