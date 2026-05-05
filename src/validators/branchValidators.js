const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  BRANCH VALIDATORS
// ─────────────────────────────────────────────

exports.validateCreateBranch = [
  body('name')
    .notEmpty().withMessage('Branch name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Branch name must be between 2 and 100 characters')
    .trim(),

  body('location')
    .notEmpty().withMessage('Location is required')
    .trim(),

  body('address')
    .optional()
    .trim(),

  body('phone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('manager')
    .optional()
    .isMongoId().withMessage('Manager must be a valid user ID'),
];

exports.validateUpdateBranch = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Branch name must be between 2 and 100 characters')
    .trim(),

  body('phone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('manager')
    .optional()
    .isMongoId().withMessage('Manager must be a valid user ID'),

  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be true or false'),
];