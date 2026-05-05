const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  ORDER VALIDATORS
// ─────────────────────────────────────────────

const VALID_CATEGORIES    = ['shirt', 'trouser', 'dress', 'suit', 'bedsheet', 'towel', 'jacket', 'other'];
const VALID_SERVICE_TYPES = ['wash', 'iron', 'wash_and_iron', 'dry_clean'];
const VALID_STATUSES      = ['received', 'washing', 'ironing', 'packaging', 'ready', 'collected', 'uncollected'];

exports.validateCreateOrder = [
  body('customer')
    .notEmpty().withMessage('Customer ID is required')
    .isMongoId().withMessage('Customer must be a valid ID'),

  body('branch')
    .optional()
    .isMongoId().withMessage('Branch must be a valid ID'),

  // items array
  body('items')
    .isArray({ min: 1 }).withMessage('Order must have at least one item'),

  body('items.*.category')
    .notEmpty().withMessage('Item category is required')
    .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),

  body('items.*.serviceType')
    .notEmpty().withMessage('Service type is required')
    .isIn(VALID_SERVICE_TYPES).withMessage(`Service type must be one of: ${VALID_SERVICE_TYPES.join(', ')}`),

  body('items.*.quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),

  body('items.*.unitPrice')
    .notEmpty().withMessage('Unit price is required')
    .isFloat({ min: 0 }).withMessage('Unit price must be 0 or greater'),

  body('items.*.description')
    .optional()
    .trim(),

  // collection
  body('collectionType')
    .optional()
    .isIn(['pickup', 'delivery']).withMessage('Collection type must be pickup or delivery'),

  body('deliveryAddress')
    .if(body('collectionType').equals('delivery'))
    .notEmpty().withMessage('Delivery address is required when collection type is delivery'),

  body('expectedReadyDate')
    .optional()
    .isISO8601().withMessage('Expected ready date must be a valid date')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Expected ready date cannot be in the past');
      }
      return true;
    }),

  // payment
  body('amountPaid')
    .optional()
    .isFloat({ min: 0 }).withMessage('Amount paid must be 0 or greater'),

  body('paymentMethod')
    .optional()
    .isIn(['cash', 'mobile_money', 'card']).withMessage('Payment method must be cash, mobile_money, or card'),

  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
    .trim(),
];

exports.validateUpdateOrderStatus = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
];