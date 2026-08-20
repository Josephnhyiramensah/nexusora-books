// server/middleware/validate.js
//
// Runs after a route's express-validator chains. If any check failed, it stops
// the request with a clean 400 and the first error message — so controllers only
// ever see well-formed input, and malformed/malicious payloads (e.g. an object
// where a string was expected) never reach a database query.

const { validationResult } = require('express-validator');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  next();
};
