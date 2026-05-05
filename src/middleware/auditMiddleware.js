const  AuditLog  = require('../models/AuditLog');

// ─────────────────────────────────────────────
//  AUDIT LOGGER
//  Wraps controller actions to auto-create audit logs
// ─────────────────────────────────────────────

/**
 * Middleware factory — wraps a route to log the action after it completes.
 *
 * Usage in routes:
 *   router.put('/:id/status', protect, audit('UPDATE_ORDER_STATUS', 'Order'), orderController.updateStatus)
 *
 * @param {string} action  - e.g. 'CREATE_ORDER', 'RECORD_PAYMENT'
 * @param {string} entity  - e.g. 'Order', 'Payment'
 */
const audit = (action, entity) => {
  return async (req, res, next) => {
    // Intercept res.json to capture the response and log after send
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      // Only log successful mutations (2xx responses)
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.data) {
        try {
          const entityId =
            body.data?._id ||
            body.data?.order?._id ||
            body.data?.payment?._id ||
            req.params.id ||
            null;

          if (entityId) {
            await AuditLog.create({
              action,
              entity,
              entityId,
              performedBy: req.user._id,
              branch: req.user.branch?._id || null,
              before: req.auditBefore || null, // set on req by controller if needed
              after: body.data,
              ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
              description: `${req.user.name} performed ${action} on ${entity}`,
            });
          }
        } catch (err) {
          // Audit logging failure must never break the main request
          console.error('⚠️  Audit log failed:', err.message);
        }
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Standalone function to manually create an audit log entry.
 * Use inside controllers for more fine-grained control.
 *
 * @param {Object} params
 */
const createAuditLog = async ({
  action,
  entity,
  entityId,
  performedBy,
  branch = null,
  before = null,
  after = null,
  ipAddress = null,
  description = null,
}) => {
  try {
    await AuditLog.create({
      action,
      entity,
      entityId,
      performedBy,
      branch,
      before,
      after,
      ipAddress,
      description,
    });
  } catch (err) {
    console.error('⚠️  Manual audit log failed:', err.message);
  }
};

module.exports = { audit, createAuditLog };