// server/routes/paymentGatewayRoutes.js
// Paystack subscription payments — initialize, verify, check status

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  initializePayment,
  verifyPayment,
  getSubscriptionStatus,
} = require('../controllers/paymentGatewayController');

// Webhook is registered directly in server.js (needs raw body before express.json)
router.get('/verify/:reference', verifyPayment);
router.post('/initialize', protect, initializePayment);
router.get('/status/:subdomain', getSubscriptionStatus);

module.exports = router;