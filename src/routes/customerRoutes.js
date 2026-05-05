const express = require('express');
const router  = express.Router();

const customerController = require('../controllers/customerController');
const { protect, restrictTo, injectBranchFilter } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateCreateCustomer, validateUpdateCustomer } = require('../validators/customerValidators');

router.use(protect);
router.use(injectBranchFilter);

// ── Special list routes ───────────────────────────────────────────────────────
router.get('/status/loyal',    customerController.getLoyalCustomers);
router.get('/status/inactive', customerController.getInactiveCustomers);

// ── Standard CRUD ─────────────────────────────────────────────────────────────
router.get('/',  customerController.getAllCustomers);
router.post('/', validateCreateCustomer, validateRequest, customerController.createCustomer);
router.get('/:id', customerController.getCustomerById);

router.put(
  '/:id',
  restrictTo('hq_admin', 'branch_manager'),
  validateUpdateCustomer, validateRequest,
  customerController.updateCustomer
);

// ── Customer history ──────────────────────────────────────────────────────────
router.get('/:id/orders', customerController.getCustomerOrderHistory);

module.exports = router;