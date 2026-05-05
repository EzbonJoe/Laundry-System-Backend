const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

// ─────────────────────────────────────────────
//  VALIDATE REQUEST
//  Reads results from express-validator chains and
//  returns a clean 400 error if any field fails.
// ─────────────────────────────────────────────

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Collect all error messages into a readable string
    const messages = errors.array().map((err) => `${err.path}: ${err.msg}`).join(', ');
    return next(new AppError(`Validation failed — ${messages}`, 400));
  }

  next();
};

module.exports = { validateRequest };