// server/validators/billValidators.js
//
// Shape/type validation for bill routes. Mirrors invoices with `vendor` instead
// of `customer`. Totals, numbering, vendor existence and status stay in the
// controller. customFields (tenant-defined) are allowed as an object.

const { body } = require('express-validator');

const lineRules = (prefix) => [
  body(`${prefix}.description`)
    .isString().withMessage('Each line needs a description.')
    .bail()
    .trim()
    .notEmpty().withMessage('Each line needs a description.')
    .isLength({ max: 500 }).withMessage('Line description is too long.'),
  body(`${prefix}.quantity`)
    .notEmpty().withMessage('Each line needs a quantity.')
    .bail()
    .isFloat({ min: 0 }).withMessage('Quantity must be a number of 0 or more.'),
  body(`${prefix}.unitPrice`)
    .notEmpty().withMessage('Each line needs a unit price.')
    .bail()
    .isFloat({ min: 0 }).withMessage('Unit price must be a number of 0 or more.'),
  body(`${prefix}.account`)
    .optional({ nullable: true })
    .isMongoId().withMessage('Line account must be a valid account.'),
];

const createBillRules = [
  body('vendor')
    .isMongoId().withMessage('A valid vendor is required.'),
  body('date')
    .notEmpty().withMessage('Bill date is required.')
    .bail()
    .isISO8601().withMessage('Bill date must be a valid date.'),
  body('dueDate')
    .notEmpty().withMessage('Due date is required.')
    .bail()
    .isISO8601().withMessage('Due date must be a valid date.'),
  body('lines')
    .isArray({ min: 1 }).withMessage('At least one line item is required.')
    .bail(),
  ...lineRules('lines.*'),
  body('taxRate')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100.'),
  body('notes')
    .optional({ nullable: true })
    .isString().withMessage('Notes must be text.')
    .isLength({ max: 2000 }).withMessage('Notes are too long.'),
  body('customFields')
    .optional({ nullable: true })
    .isObject().withMessage('Invalid custom fields.'),
];

module.exports = { createBillRules };
