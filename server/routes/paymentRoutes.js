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
const validate = require('../middleware/validate');
const { receivePaymentRules, makePaymentRules } = require('../validators/accountingPaymentValidators');

router.use(protect);

router.get('/', getPayments);
router.get('/:id', getPayment);
router.post('/receive', authorise('super_admin', 'admin', 'accountant'), receivePaymentRules, validate, receivePayment);
router.post('/make', authorise('super_admin', 'admin', 'accountant'), makePaymentRules, validate, makePayment);

module.exports = router;
