const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  FEEDBACK VALIDATORS
// ─────────────────────────────────────────────

const VALID_CATEGORIES = ['service_quality', 'turnaround_time', 'pricing', 'staff_attitude', 'cleanliness', 'general'];

exports.validateSubmitFeedback = [
  body('customer')
    .notEmpty().withMessage('Customer ID is required')
    .isMongoId().withMessage('Customer must be a valid ID'),

  body('order')
    .notEmpty().withMessage('Order ID is required')
    .isMongoId().withMessage('Order must be a valid ID'),

  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be a number between 1 and 5'),

  body('comment')
    .optional()
    .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
    .trim(),

  body('category')
    .optional()
    .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),
];