// server/validators/paymentValidators.js
//
// express-validator chains for the Paystack payment routes. The controller still
// re-checks plan/cycle against its own PLAN_PRICES/PLAN_DAYS maps (defence in
// depth); these rules reject malformed or wrongly-typed input with a clean 400
// before the controller runs, and stop object-injection reaching any logic.

const { body } = require('express-validator');

const PAID_PLANS = ['starter', 'professional', 'enterprise'];
const BILLING_CYCLES = ['monthly', 'semi_annual', 'annual'];

const initializePaymentRules = [
  body('plan')
    .isString().withMessage('A plan is required.')
    .bail()
    .isIn(PAID_PLANS).withMessage('Invalid plan.'),
  body('billingCycle')
    .isString().withMessage('A billing cycle is required.')
    .bail()
    .isIn(BILLING_CYCLES).withMessage('Invalid billing cycle.'),
  body('email')
    .isString().withMessage('A valid email is required.')
    .bail()
    .trim()
    .isEmail().withMessage('A valid email is required.')
    .normalizeEmail()
    .isLength({ max: 200 }).withMessage('A valid email is required.'),
  body('subdomain')
    .isString().withMessage('A workspace is required.')
    .bail()
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/).withMessage('Invalid workspace.')
    .isLength({ max: 63 }).withMessage('Invalid workspace.'),
];

module.exports = { initializePaymentRules };
