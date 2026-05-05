const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  EXPENSE VALIDATORS
// ─────────────────────────────────────────────

const VALID_CATEGORIES = ['utilities', 'supplies', 'maintenance', 'salaries', 'rent', 'transport', 'other'];

exports.validateRecordExpense = [
  body('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 3, max: 300 }).withMessage('Description must be between 3 and 300 characters')
    .trim(),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),

  body('branch')
    .optional()
    .isMongoId().withMessage('Branch must be a valid ID'),

  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid date'),

  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
    .trim(),
];