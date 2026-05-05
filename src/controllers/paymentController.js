const  Payment  = require('../models/Payment');
const  Order  = require('../models/Order');
const  Notification  = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');

// ─────────────────────────────────────────────
//  RECORD PAYMENT
// ─────────────────────────────────────────────

exports.recordPayment = catchAsync(async (req, res, next) => {
  const { orderId, amount, method, notes } = req.body;

  const order = await Order.findById(orderId).populate('customer');
  if (!order) return next(new AppError('Order not found.', 404));

  if (order.paymentStatus === 'paid') {
    return next(new AppError('This order is already fully paid.', 400));
  }

  const branch = order.branch;

  // Check for underpayment (fraud flag)
  const remaining = order.totalAmount - order.amountPaid;
  const isFlagged = amount < remaining && amount < order.totalAmount;
  const flagReason = isFlagged
    ? `Payment of ${amount} is less than remaining balance of ${remaining}`
    : null;

  const payment = await Payment.create({
    order:      orderId,
    customer:   order.customer._id,
    branch,
    amount,
    method,
    receivedBy: req.user._id,
    isFlagged,
    flagReason,
    notes,
  });

  // Update order's amountPaid
  order.amountPaid    += amount;
  order.paymentMethod  = method;
  await order.save();

  // If flagged, create fraud alert notification for managers
  if (isFlagged) {
    await Notification.create({
      type:            'fraud_alert',
      message:         `⚠️ Suspicious payment on order ${order.orderNumber}: ${flagReason}`,
      recipient:       req.user._id,
      branch,
      order:           order._id,
      relatedEntity:   'Payment',
      relatedEntityId: payment._id,
    });
  }

  await createAuditLog({
    action:      'RECORD_PAYMENT',
    entity:      'Payment',
    entityId:    payment._id,
    performedBy: req.user._id,
    branch,
    after:       payment.toObject(),
    ipAddress:   req.ip,
    description: `${req.user.name} recorded payment of ${amount} for order ${order.orderNumber}${isFlagged ? ' [FLAGGED]' : ''}`,
  });

  const populated = await Payment.findById(payment._id)
    .populate('order', 'orderNumber totalAmount amountPaid paymentStatus')
    .populate('customer', 'name phone')
    .populate('receivedBy', 'name');

  sendSuccess(res, 201, 'Payment recorded successfully', populated);
});

// ─────────────────────────────────────────────
//  GET ALL PAYMENTS
// ─────────────────────────────────────────────

exports.getAllPayments = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  if (req.query.method)     filter.method     = req.query.method;
  if (req.query.isFlagged)  filter.isFlagged  = req.query.isFlagged === 'true';

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('order', 'orderNumber totalAmount')
      .populate('customer', 'name phone')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  sendPaginated(res, payments, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET PAYMENTS BY ORDER
// ─────────────────────────────────────────────

exports.getPaymentsByOrder = catchAsync(async (req, res, next) => {
  const payments = await Payment.find({ order: req.params.orderId })
    .populate('receivedBy', 'name')
    .sort({ createdAt: -1 });

  sendSuccess(res, 200, 'Payments retrieved', payments);
});

// ─────────────────────────────────────────────
//  GET PAYMENTS BY BRANCH
// ─────────────────────────────────────────────

exports.getPaymentsByBranch = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { branch: req.params.branchId };

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('order', 'orderNumber')
      .populate('customer', 'name')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  sendPaginated(res, payments, total, page, limit);
});

// ─────────────────────────────────────────────
//  GENERATE RECEIPT  (returns receipt data)
// ─────────────────────────────────────────────

exports.generateReceipt = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate({
      path:     'order',
      populate: [
        { path: 'customer', select: 'name phone email' },
        { path: 'branch',   select: 'name location address phone' },
      ],
    })
    .populate('receivedBy', 'name');

  if (!payment) return next(new AppError('Payment not found.', 404));

  const receipt = {
    receiptNumber: payment.receiptNumber,
    date:          payment.createdAt,
    customer:      payment.order.customer,
    branch:        payment.order.branch,
    order: {
      orderNumber:   payment.order.orderNumber,
      items:         payment.order.items,
      totalAmount:   payment.order.totalAmount,
      amountPaid:    payment.order.amountPaid,
      paymentStatus: payment.order.paymentStatus,
      balance:       payment.order.totalAmount - payment.order.amountPaid,
    },
    payment: {
      amount:     payment.amount,
      method:     payment.method,
      receivedBy: payment.receivedBy.name,
    },
  };

  sendSuccess(res, 200, 'Receipt generated', receipt);
});

// ─────────────────────────────────────────────
//  FLAG / UNFLAG PAYMENT
// ─────────────────────────────────────────────

exports.flagPayment = catchAsync(async (req, res, next) => {
  const { isFlagged, flagReason } = req.body;

  const payment = await Payment.findById(req.params.id);
  if (!payment) return next(new AppError('Payment not found.', 404));

  payment.isFlagged  = isFlagged;
  payment.flagReason = isFlagged ? flagReason : null;
  await payment.save();

  await createAuditLog({
    action:      isFlagged ? 'FLAG_PAYMENT' : 'UNFLAG_PAYMENT',
    entity:      'Payment',
    entityId:    payment._id,
    performedBy: req.user._id,
    branch:      payment.branch,
    ipAddress:   req.ip,
    description: `${req.user.name} ${isFlagged ? 'flagged' : 'unflagged'} payment ${payment.receiptNumber}`,
  });

  sendSuccess(res, 200, `Payment ${isFlagged ? 'flagged' : 'unflagged'} successfully`, payment);
});