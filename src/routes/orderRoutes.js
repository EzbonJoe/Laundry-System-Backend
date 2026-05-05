const express = require('express');
const router  = express.Router();

const orderController = require('../controllers/orderController');
const { protect, restrictTo, restrictToBranch, injectBranchFilter } = require('../middleware/authMiddleware');
const { audit } = require('../middleware/auditMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateCreateOrder, validateUpdateOrderStatus } = require('../validators/orderValidators');

router.use(protect);
router.use(injectBranchFilter);

// ── Special routes ────────────────────────────────────────────────────────────
router.get('/uncollected', orderController.getUncollectedOrders);

// ── Branch & Customer filtered lists ─────────────────────────────────────────
router.get('/branch/:branchId',     restrictToBranch,        orderController.getOrdersByBranch);
router.get('/customer/:customerId',                          orderController.getOrdersByCustomer);

// ── Standard CRUD ─────────────────────────────────────────────────────────────
router.get('/',    orderController.getAllOrders);
router.post('/',   validateCreateOrder, validateRequest, audit('CREATE_ORDER', 'Order'), orderController.createOrder);
router.get('/:id', orderController.getOrderById);

// ── Status transitions ────────────────────────────────────────────────────────
router.patch('/:id/status',  validateUpdateOrderStatus, validateRequest, audit('UPDATE_ORDER_STATUS', 'Order'),  orderController.updateOrderStatus);
router.patch('/:id/collect', audit('MARK_ORDER_COLLECTED', 'Order'), orderController.markOrderCollected);

// ── Delete (HQ Admin only) ────────────────────────────────────────────────────
router.delete('/:id', restrictTo('hq_admin'), orderController.deleteOrder);

module.exports = router;