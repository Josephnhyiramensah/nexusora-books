// server/validators/authValidators.js
//
// express-validator chains for the auth routes. Kept separate from the routes so
// the validation rules are readable and reusable. Each exported array is dropped
// into its route before the `validate` middleware and the controller.
//
// Design notes:
//  - Login messages are deliberately generic ("A valid email is required") and do
//    NOT reveal whether the account exists — consistent with the controller's
//    no-enumeration policy.
//  - `.isString()` / `.isEmail()` reject objects like { $gt: '' }, so a NoSQL
//    injection payload is turned away with a clean 400 before any query runs.
//  - Length caps stop oversized-body abuse.

const { body } = require('express-validator');

const loginRules = [
  body('email')
    .isString().withMessage('A valid email is required.')
    .bail()
    .trim()
    .isEmail().withMessage('A valid email is required.')
    .normalizeEmail()
    .isLength({ max: 200 }).withMessage('A valid email is required.'),
  body('password')
    .isString().withMessage('Password is required.')
    .bail()
    .notEmpty().withMessage('Password is required.')
    .isLength({ max: 200 }).withMessage('Password is too long.'),
];

const registerRules = [
  body('firstName')
    .isString().withMessage('First name is required.')
    .bail()
    .trim()
    .notEmpty().withMessage('First name is required.')
    .isLength({ max: 60 }).withMessage('First name is too long.'),
  body('lastName')
    .isString().withMessage('Last name is required.')
    .bail()
    .trim()
    .notEmpty().withMessage('Last name is required.')
    .isLength({ max: 60 }).withMessage('Last name is too long.'),
  body('email')
    .isString().withMessage('A valid email is required.')
    .bail()
    .trim()
    .isEmail().withMessage('A valid email is required.')
    .normalizeEmail()
    .isLength({ max: 200 }).withMessage('A valid email is required.'),
  body('password')
    .isString().withMessage('Password is required.')
    .bail()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .isLength({ max: 200 }).withMessage('Password is too long.'),
  // role is optional; when present it must be a short string. The controller
  // still enforces the actual allowlist — this only rejects garbage types.
  body('role').optional().isString().withMessage('Invalid role.').isLength({ max: 30 }),
  body('phone').optional().isString().withMessage('Invalid phone number.').isLength({ max: 30 }),
];

const changePasswordRules = [
  body('currentPassword')
    .isString().withMessage('Current password is required.')
    .bail()
    .notEmpty().withMessage('Current password is required.')
    .isLength({ max: 200 }),
  body('newPassword')
    .isString().withMessage('New password is required.')
    .bail()
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
    .isLength({ max: 200 }).withMessage('New password is too long.'),
];

module.exports = { loginRules, registerRules, changePasswordRules };
