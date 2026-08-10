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
const tenantMiddleware = require('../middleware/tenantMiddleware');

// Webhook is registered directly in server.js (needs raw body before express.json)

router.get('/verify/:reference', verifyPayment);                          // no tm — post-redirect, no subdomain
router.post('/initialize', tenantMiddleware, protect, initializePayment); // tm so protect can resolve the user
router.get('/status/:subdomain', getSubscriptionStatus);                  // identifies tenant from param

module.exports = router;