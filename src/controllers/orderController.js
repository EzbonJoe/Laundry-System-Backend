const  Order  = require('../models/Order');
const  Notification  = require('../models/Notification');
const  Customer  = require('../models/Customer');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');
const { isValidTransition, STATUS_LABELS } = require('../config/orderStatuses');
const { notifyOrderReady } = require('../utils/notifications');

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const calculateTotal = (items) =>
  items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

// ─────────────────────────────────────────────
//  CREATE ORDER
// ─────────────────────────────────────────────

exports.createOrder = catchAsync(async (req, res, next) => {
  const {
    customer: customerId,
    items,
    collectionType,
    deliveryAddress,
    expectedReadyDate,
    paymentMethod,
    amountPaid = 0,
    notes,
  } = req.body;

  // Resolve branch from logged-in user (staff/manager) or from body (hq_admin)
  const branch = req.user.branch?._id || req.body.branch;
  if (!branch) return next(new AppError('Branch is required.', 400));

  // Validate customer exists and belongs to this branch
  const customer = await Customer.findById(customerId);
  if (!customer) return next(new AppError('Customer not found.', 404));

  // Calculate subtotals and total
  const enrichedItems = items.map((item) => ({
    ...item,
    subtotal: item.quantity * item.unitPrice,
  }));
  const totalAmount = calculateTotal(enrichedItems);

  const order = await Order.create({
    customer:        customerId,
    branch,
    receivedBy:      req.user._id,
    items:           enrichedItems,
    totalAmount,
    amountPaid,
    collectionType,
    deliveryAddress: collectionType === 'delivery' ? deliveryAddress : null,
    expectedReadyDate,
    paymentMethod:   amountPaid > 0 ? paymentMethod : null,
    notes,
    statusHistory:   [{ status: 'received', changedBy: req.user._id }],
  });

  // Update customer stats
  await Customer.findByIdAndUpdate(customerId, {
    $inc: { totalOrders: 1 },
    lastOrderDate: new Date(),
    loyaltyStatus: 'active',
  });

  await createAuditLog({
    action:      'CREATE_ORDER',
    entity:      'Order',
    entityId:    order._id,
    performedBy: req.user._id,
    branch,
    after:       order.toObject(),
    ipAddress:   req.ip,
    description: `${req.user.name} created order ${order.orderNumber}`,
  });

  const populated = await Order.findById(order._id)
    .populate('customer', 'name phone')
    .populate('branch', 'name')
    .populate('receivedBy', 'name');

  sendSuccess(res, 201, 'Order created successfully', populated);
});

// ─────────────────────────────────────────────
//  GET ALL ORDERS
// ─────────────────────────────────────────────

exports.getAllOrders = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  if (req.query.status)        filter.status        = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

  // Date range filter
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name phone')
      .populate('branch', 'name')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  sendPaginated(res, orders, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET ORDER BY ID
// ─────────────────────────────────────────────

exports.getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('branch', 'name location')
    .populate('receivedBy', 'name')
    .populate('collectedBy', 'name')
    .populate('statusHistory.changedBy', 'name');

  if (!order) return next(new AppError('Order not found.', 404));

  sendSuccess(res, 200, 'Order retrieved', order);
});

// ─────────────────────────────────────────────
//  UPDATE ORDER STATUS
// ─────────────────────────────────────────────

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id).populate('customer');

  if (!order) return next(new AppError('Order not found.', 404));

  // Validate the transition is allowed
  if (!isValidTransition(order.status, status)) {
    return next(
      new AppError(
        `Cannot move order from "${order.status}" to "${status}". Invalid status transition.`,
        400
      )
    );
  }

  const before = order.toObject();

  order.status = status;
  order.statusHistory.push({ status, changedBy: req.user._id });

  // If order is now ready, notify the customer
  if (status === 'ready' && order.customer) {
    await notifyOrderReady(order.customer, order);

    // Create in-app notification for branch staff
    await Notification.create({
      type:      'order_ready',
      message:   `Order ${order.orderNumber} is ready for collection`,
      recipient: order.receivedBy,
      branch:    order.branch,
      order:     order._id,
    });
  }

  await order.save();

  await createAuditLog({
    action:      'UPDATE_ORDER_STATUS',
    entity:      'Order',
    entityId:    order._id,
    performedBy: req.user._id,
    branch:      order.branch,
    before:      { status: before.status },
    after:       { status: order.status },
    ipAddress:   req.ip,
    description: `${req.user.name} moved order ${order.orderNumber} from "${before.status}" to "${status}"`,
  });

  sendSuccess(res, 200, `Order status updated to "${STATUS_LABELS[status]}"`, order);
});

// ─────────────────────────────────────────────
//  MARK ORDER AS COLLECTED
// ─────────────────────────────────────────────

exports.markOrderCollected = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found.', 404));

  if (!['ready', 'uncollected'].includes(order.status)) {
    return next(new AppError('Only ready or uncollected orders can be marked as collected.', 400));
  }

  if (order.paymentStatus !== 'paid') {
    return next(new AppError('Order cannot be collected until payment is complete.', 400));
  }

  const before = order.toObject();

  order.status       = 'collected';
  order.collectedAt  = new Date();
  order.collectedBy  = req.user._id;
  order.statusHistory.push({ status: 'collected', changedBy: req.user._id });

  await order.save();

  // Update customer total spend
  await Customer.findByIdAndUpdate(order.customer, {
    $inc: { totalSpent: order.totalAmount },
  });

  await createAuditLog({
    action:      'MARK_ORDER_COLLECTED',
    entity:      'Order',
    entityId:    order._id,
    performedBy: req.user._id,
    branch:      order.branch,
    before:      { status: before.status },
    after:       { status: 'collected', collectedAt: order.collectedAt },
    ipAddress:   req.ip,
    description: `${req.user.name} marked order ${order.orderNumber} as collected`,
  });

  sendSuccess(res, 200, 'Order marked as collected', order);
});

// ─────────────────────────────────────────────
//  GET UNCOLLECTED ORDERS
// ─────────────────────────────────────────────

exports.getUncollectedOrders = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);

  const thresholdDays = parseInt(process.env.UNCOLLECTED_ORDER_DAYS) || 7;
  const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  const filter = {
    ...req.branchFilter,
    status: { $in: ['ready', 'uncollected'] },
    expectedReadyDate: { $lt: cutoffDate },
  };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name phone')
      .populate('branch', 'name')
      .sort({ expectedReadyDate: 1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  sendPaginated(res, orders, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET ORDERS BY BRANCH
// ─────────────────────────────────────────────

exports.getOrdersByBranch = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { branch: req.params.branchId };

  if (req.query.status) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name phone')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  sendPaginated(res, orders, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET ORDERS BY CUSTOMER
// ─────────────────────────────────────────────

exports.getOrdersByCustomer = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { customer: req.params.customerId };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('branch', 'name')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  sendPaginated(res, orders, total, page, limit);
});

// ─────────────────────────────────────────────
//  DELETE ORDER  (HQ Admin only — with audit)
// ─────────────────────────────────────────────

exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found.', 404));

  if (order.status === 'collected') {
    return next(new AppError('Collected orders cannot be deleted.', 400));
  }

  await createAuditLog({
    action:      'DELETE_ORDER',
    entity:      'Order',
    entityId:    order._id,
    performedBy: req.user._id,
    branch:      order.branch,
    before:      order.toObject(),
    ipAddress:   req.ip,
    description: `${req.user.name} deleted order ${order.orderNumber}`,
  });

  await order.deleteOne();

  sendSuccess(res, 200, 'Order deleted successfully');
});