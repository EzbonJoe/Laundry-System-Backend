const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  AUTH VALIDATORS
// ─────────────────────────────────────────────

exports.validateLogin = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

exports.validateRegister = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .trim(),

  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['hq_admin', 'branch_manager', 'staff']).withMessage('Role must be hq_admin, branch_manager, or staff'),

  body('branch')
    .if(body('role').isIn(['branch_manager', 'staff']))
    .notEmpty().withMessage('Branch is required for branch_manager and staff roles')
    .isMongoId().withMessage('Branch must be a valid ID'),

  body('phone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid phone number'),
];

exports.validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    .matches(/\d/).withMessage('New password must contain at least one number'),
];

exports.validateResetPassword = [
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('User ID must be a valid ID'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    .matches(/\d/).withMessage('New password must contain at least one number'),
];