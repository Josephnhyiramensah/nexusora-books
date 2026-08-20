// server/validators/paymentValidators.js
//
// Shape/type validation for accounting-payment routes (receive from customer /
// pay to vendor). Amount is required and must be positive; method is constrained
// to the model's enum. The controller still checks the invoice/bill exists,
// belongs to the tenant, and that the amount does not exceed the balance.

const { body } = require('express-validator');

const METHODS = ['cash', 'bank_transfer', 'cheque', 'mobile_money', 'card'];

const receivePaymentRules = [
  body('invoiceId')
    .isMongoId().withMessage('A valid invoice is required.'),
  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .bail()
    .isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
  body('date')
    .notEmpty().withMessage('Payment date is required.')
    .bail()
    .isISO8601().withMessage('Payment date must be a valid date.'),
  body('method')
    .isString().withMessage('A payment method is required.')
    .bail()
    .isIn(METHODS).withMessage('Invalid payment method.'),
  body('reference')
    .optional({ nullable: true })
    .isString().withMessage('Reference must be text.')
    .isLength({ max: 100 }).withMessage('Reference is too long.'),
  body('notes')
    .optional({ nullable: true })
    .isString().withMessage('Notes must be text.')
    .isLength({ max: 2000 }).withMessage('Notes are too long.'),
];

const makePaymentRules = [
  body('billId')
    .isMongoId().withMessage('A valid bill is required.'),
  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .bail()
    .isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
  body('date')
    .notEmpty().withMessage('Payment date is required.')
    .bail()
    .isISO8601().withMessage('Payment date must be a valid date.'),
  body('method')
    .isString().withMessage('A payment method is required.')
    .bail()
    .isIn(METHODS).withMessage('Invalid payment method.'),
  body('reference')
    .optional({ nullable: true })
    .isString().withMessage('Reference must be text.')
    .isLength({ max: 100 }).withMessage('Reference is too long.'),
  body('notes')
    .optional({ nullable: true })
    .isString().withMessage('Notes must be text.')
    .isLength({ max: 2000 }).withMessage('Notes are too long.'),
];

module.exports = { receivePaymentRules, makePaymentRules };
