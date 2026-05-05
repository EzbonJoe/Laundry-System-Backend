const { body } = require('express-validator');

// ─────────────────────────────────────────────
//  MACHINE VALIDATORS
// ─────────────────────────────────────────────

const VALID_TYPES    = ['washer', 'dryer', 'iron_press', 'dry_clean_machine'];
const VALID_STATUSES = ['idle', 'in_use', 'maintenance', 'out_of_service'];

exports.validateAddMachine = [
  body('name')
    .notEmpty().withMessage('Machine name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .trim(),

  body('type')
    .notEmpty().withMessage('Machine type is required')
    .isIn(VALID_TYPES).withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),

  body('branch')
    .optional()
    .isMongoId().withMessage('Branch must be a valid ID'),

  body('serialNumber')
    .optional()
    .trim(),

  body('lastMaintenanceDate')
    .optional()
    .isISO8601().withMessage('Last maintenance date must be a valid date'),

  body('nextMaintenanceDue')
    .optional()
    .isISO8601().withMessage('Next maintenance due date must be a valid date'),
];

exports.validateUpdateMachineStatus = [
  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),

  body('lastMaintenanceDate')
    .optional()
    .isISO8601().withMessage('Last maintenance date must be a valid date'),

  body('nextMaintenanceDue')
    .optional()
    .isISO8601().withMessage('Next maintenance due date must be a valid date'),

  body().custom((value, { req }) => {
    const fields = ['status', 'lastMaintenanceDate', 'nextMaintenanceDue', 'notes'];
    const hasAny = fields.some((f) => req.body[f] !== undefined);
    if (!hasAny) throw new Error('At least one field must be provided to update');
    return true;
  }),
];

exports.validateLogMachineUsage = [
  body('orderId')
    .notEmpty().withMessage('Order ID is required')
    .isMongoId().withMessage('Order ID must be a valid ID'),

  body('startTime')
    .notEmpty().withMessage('Start time is required')
    .isISO8601().withMessage('Start time must be a valid date/time'),

  body('endTime')
    .optional()
    .isISO8601().withMessage('End time must be a valid date/time')
    .custom((value, { req }) => {
      if (value && new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
];