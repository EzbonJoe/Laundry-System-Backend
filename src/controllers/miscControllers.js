const  CustomerFeedback  = require('../models/CustomerFeedback');
const  Notification  = require('../models/Notification');
const  AuditLog  = require('../models/AuditLog');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');

// ═════════════════════════════════════════════
//  NOTIFICATION CONTROLLER
// ═════════════════════════════════════════════

exports.getMyNotifications = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { recipient: req.user._id };

  if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);

  sendPaginated(res, notifications, total, page, limit);
});

exports.markNotificationRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) return next(new AppError('Notification not found.', 404));

  sendSuccess(res, 200, 'Notification marked as read', notification);
});

exports.markAllRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  sendSuccess(res, 200, 'All notifications marked as read');
});

exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) return next(new AppError('Notification not found.', 404));

  sendSuccess(res, 200, 'Notification deleted');
});

// ═════════════════════════════════════════════
//  AUDIT LOG CONTROLLER
// ═════════════════════════════════════════════

exports.getAllLogs = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};

  if (req.query.entity)  filter.entity  = req.query.entity;
  if (req.query.action)  filter.action  = req.query.action;
  if (req.query.branch)  filter.branch  = req.query.branch;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('performedBy', 'name role')
      .populate('branch', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  sendPaginated(res, logs, total, page, limit);
});

exports.getLogsByUser = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);

  const [logs, total] = await Promise.all([
    AuditLog.find({ performedBy: req.params.userId })
      .populate('branch', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments({ performedBy: req.params.userId }),
  ]);

  sendPaginated(res, logs, total, page, limit);
});

exports.getLogsByBranch = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);

  const [logs, total] = await Promise.all([
    AuditLog.find({ branch: req.params.branchId })
      .populate('performedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments({ branch: req.params.branchId }),
  ]);

  sendPaginated(res, logs, total, page, limit);
});

// ═════════════════════════════════════════════
//  CUSTOMER FEEDBACK CONTROLLER
// ═════════════════════════════════════════════

exports.submitFeedback = catchAsync(async (req, res, next) => {
  const { customer, order, rating, comment, category } = req.body;
  const branch = req.body.branch || req.user.branch?._id;

  const existing = await CustomerFeedback.findOne({ customer, order });
  if (existing) return next(new AppError('Feedback for this order has already been submitted.', 400));

  const feedback = await CustomerFeedback.create({ customer, order, branch, rating, comment, category });

  sendSuccess(res, 201, 'Feedback submitted successfully', feedback);
});

exports.getFeedbackByBranch = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { branch: req.params.branchId };

  if (req.query.rating)     filter.rating     = parseInt(req.query.rating);
  if (req.query.isReviewed) filter.isReviewed = req.query.isReviewed === 'true';

  const [feedback, total] = await Promise.all([
    CustomerFeedback.find(filter)
      .populate('customer', 'name phone')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    CustomerFeedback.countDocuments(filter),
  ]);

  sendPaginated(res, feedback, total, page, limit);
});

exports.getFeedbackByOrder = catchAsync(async (req, res, next) => {
  const feedback = await CustomerFeedback.findOne({ order: req.params.orderId })
    .populate('customer', 'name')
    .populate('reviewedBy', 'name');

  sendSuccess(res, 200, 'Feedback retrieved', feedback || null);
});

exports.getAverageRating = catchAsync(async (req, res, next) => {
  const filter = { ...req.branchFilter };

  const result = await CustomerFeedback.aggregate([
    { $match: filter },
    {
      $group: {
        _id:           '$branch',
        averageRating: { $avg: '$rating' },
        totalReviews:  { $sum: 1 },
        breakdown: {
          $push: '$rating',
        },
      },
    },
    { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
    { $unwind: { path: '$someField', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        branchName:    { $ifNull: ['$branch.name', 'Unknown'] },
        averageRating: { $round: ['$averageRating', 1] },
        totalReviews:  1,
      },
    },
    { $sort: { averageRating: -1 } },
  ]);

  sendSuccess(res, 200, 'Average ratings by branch', result);
});

exports.markFeedbackReviewed = catchAsync(async (req, res, next) => {
  const feedback = await CustomerFeedback.findByIdAndUpdate(
    req.params.id,
    { isReviewed: true, reviewedBy: req.user._id },
    { new: true }
  );

  if (!feedback) return next(new AppError('Feedback not found.', 404));

  sendSuccess(res, 200, 'Feedback marked as reviewed', feedback);
});