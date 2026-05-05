const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  CUSTOMER VALIDATORS
// ─────────────────────────────────────────────

exports.validateCreateCustomer = [
  body('name')
    .notEmpty().withMessage('Customer name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .trim(),

  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('email')
    .optional()
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('address')
    .optional()
    .trim(),

  body('branch')
    .optional()
    .isMongoId().withMessage('Branch must be a valid ID'),

  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
    .trim(),
];

exports.validateUpdateCustomer = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .trim(),

  body('phone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('email')
    .optional()
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
];