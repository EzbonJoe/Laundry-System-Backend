const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  PAYMENT VALIDATORS
// ─────────────────────────────────────────────

exports.validateRecordPayment = [
  body('orderId')
    .notEmpty().withMessage('Order ID is required')
    .isMongoId().withMessage('Order ID must be a valid ID'),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),

  body('method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash', 'mobile_money', 'card']).withMessage('Method must be cash, mobile_money, or card'),

  body('notes')
    .optional()
    .isLength({ max: 300 }).withMessage('Notes cannot exceed 300 characters')
    .trim(),
];

exports.validateFlagPayment = [
  body('isFlagged')
    .notEmpty().withMessage('isFlagged is required')
    .isBoolean().withMessage('isFlagged must be true or false'),

  body('flagReason')
    .if(body('isFlagged').equals('true'))
    .notEmpty().withMessage('Flag reason is required when flagging a payment')
    .isLength({ max: 300 }).withMessage('Flag reason cannot exceed 300 characters')
    .trim(),
];