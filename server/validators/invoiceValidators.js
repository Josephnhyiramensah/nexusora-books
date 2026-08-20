// server/validators/invoiceValidators.js
//
// express-validator chains for invoice routes. Shape/type only — totals,
// numbering, customer existence and status transitions stay in the controller.
// Rejects malformed or injected input (objects where numbers/strings/ids belong,
// a non-array `lines`) with a clean 400 before the controller runs.

const { body } = require('express-validator');

// Line-level rules applied to each element of lines[*].
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

const createInvoiceRules = [
  body('customer')
    .isMongoId().withMessage('A valid customer is required.'),
  body('date')
    .notEmpty().withMessage('Invoice date is required.')
    .bail()
    .isISO8601().withMessage('Invoice date must be a valid date.'),
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
  body('currency')
    .optional({ nullable: true })
    .isString().withMessage('Invalid currency.')
    .isLength({ max: 10 }).withMessage('Invalid currency.'),
  body('exchangeRate')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Exchange rate must be a positive number.'),
  // customFields is a tenant-defined map { fieldId: value }. We only ensure it's
  // an object when present; the controller snapshots and enforces required ones.
  body('customFields')
    .optional({ nullable: true })
    .isObject().withMessage('Invalid custom fields.'),
];

// Update: customer/invoiceNumber are not editable here; the controller only
// applies date/dueDate/lines/taxRate/notes. All optional (partial edit), but a
// supplied `lines` must still be a well-formed non-empty array.
const updateInvoiceRules = [
  body('date').optional({ nullable: true }).isISO8601().withMessage('Invoice date must be a valid date.'),
  body('dueDate').optional({ nullable: true }).isISO8601().withMessage('Due date must be a valid date.'),
  body('lines').optional({ nullable: true }).isArray({ min: 1 }).withMessage('At least one line item is required.'),
  ...lineRules('lines.*'),
  body('taxRate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100.'),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }).withMessage('Notes are too long.'),
];

module.exports = { createInvoiceRules, updateInvoiceRules };
