// server/validators/journalValidators.js
//
// express-validator chains for journal routes. These enforce SHAPE and TYPE only
// — the accounting rules (debits === credits, account existence, posting) stay in
// the controller's validateDoubleEntry / calculateBalanceChange. The goal here is
// to stop malformed or injected input (objects where numbers/strings belong, a
// non-array `lines`, invalid ObjectIds) from ever reaching that logic.

const { body } = require('express-validator');

// Must match the enum on the JournalEntry model exactly, or valid entries would
// be wrongly rejected.
const JOURNAL_TYPES = ['general', 'sales', 'purchases', 'cash_receipts', 'cash_payments'];

// Shared line-level rules, applied to each element of `lines[*]`.
const lineRules = (prefix) => [
  body(`${prefix}.account`)
    .isMongoId().withMessage('Each line must reference a valid account.'),
  body(`${prefix}.debit`)
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Debit must be a number of 0 or more.'),
  body(`${prefix}.credit`)
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Credit must be a number of 0 or more.'),
  body(`${prefix}.description`)
    .optional({ nullable: true })
    .isString().withMessage('Line description must be text.')
    .isLength({ max: 300 }).withMessage('Line description is too long.'),
];

const createJournalRules = [
  body('date')
    .notEmpty().withMessage('Date is required.')
    .bail()
    .isISO8601().withMessage('Date must be a valid date.'),
  body('journalType')
    .isString().withMessage('Journal type is required.')
    .bail()
    .isIn(JOURNAL_TYPES).withMessage('Invalid journal type.'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be text.')
    .isLength({ max: 500 }).withMessage('Description is too long.'),
  body('reference')
    .optional({ nullable: true })
    .isString().withMessage('Reference must be text.')
    .isLength({ max: 100 }).withMessage('Reference is too long.'),
  body('lines')
    .isArray({ min: 2 }).withMessage('A journal entry needs at least two lines.')
    .bail(),
  // Validate every element of the lines array.
  ...lineRules('lines.*'),
];

// On update, lines may be omitted (partial edit). When present, it must still be
// a well-formed array of at least two lines. The controller re-runs the balance
// check whenever lines are supplied.
const updateJournalRules = [
  body('date').optional({ nullable: true }).isISO8601().withMessage('Date must be a valid date.'),
  body('journalType').optional({ nullable: true }).isString().isIn(JOURNAL_TYPES).withMessage('Invalid journal type.'),
  body('description').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('reference').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('lines').optional({ nullable: true }).isArray({ min: 2 }).withMessage('A journal entry needs at least two lines.'),
  ...lineRules('lines.*'),
];

module.exports = { createJournalRules, updateJournalRules };
