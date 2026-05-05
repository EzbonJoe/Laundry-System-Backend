const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  INVENTORY VALIDATORS
// ─────────────────────────────────────────────

const VALID_CATEGORIES = ['detergent', 'softener', 'packaging', 'hangers', 'tags', 'other'];
const VALID_UNITS      = ['litres', 'kg', 'pieces', 'rolls', 'boxes'];

exports.validateAddInventoryItem = [
  body('name')
    .notEmpty().withMessage('Item name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .trim(),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),

  body('unit')
    .notEmpty().withMessage('Unit is required')
    .isIn(VALID_UNITS).withMessage(`Unit must be one of: ${VALID_UNITS.join(', ')}`),

  body('currentStock')
    .notEmpty().withMessage('Current stock is required')
    .isFloat({ min: 0 }).withMessage('Current stock must be 0 or greater'),

  body('minimumStockLevel')
    .notEmpty().withMessage('Minimum stock level is required')
    .isFloat({ min: 0 }).withMessage('Minimum stock level must be 0 or greater'),

  body('branch')
    .optional()
    .isMongoId().withMessage('Branch must be a valid ID'),
];

exports.validateUpdateStockLevel = [
  body('currentStock')
    .optional()
    .isFloat({ min: 0 }).withMessage('Current stock must be 0 or greater'),

  body('minimumStockLevel')
    .optional()
    .isFloat({ min: 0 }).withMessage('Minimum stock level must be 0 or greater'),

  body().custom((value, { req }) => {
    if (req.body.currentStock === undefined && req.body.minimumStockLevel === undefined) {
      throw new Error('At least one of currentStock or minimumStockLevel must be provided');
    }
    return true;
  }),
];

exports.validateLogStockUsage = [
  body('quantityUsed')
    .notEmpty().withMessage('Quantity used is required')
    .isFloat({ min: 0.01 }).withMessage('Quantity used must be greater than 0'),

  body('orderId')
    .optional()
    .isMongoId().withMessage('Order ID must be a valid ID'),

  body('notes')
    .optional()
    .isLength({ max: 300 }).withMessage('Notes cannot exceed 300 characters')
    .trim(),
];

exports.validateRestockItem = [
  body('quantityAdded')
    .notEmpty().withMessage('Quantity added is required')
    .isFloat({ min: 0.01 }).withMessage('Quantity added must be greater than 0'),

  body('supplier')
    .optional()
    .isLength({ max: 100 }).withMessage('Supplier name cannot exceed 100 characters')
    .trim(),

  body('cost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Cost must be 0 or greater'),

  body('notes')
    .optional()
    .isLength({ max: 300 }).withMessage('Notes cannot exceed 300 characters')
    .trim(),
];