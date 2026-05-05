const  { User }  = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');

// ─────────────────────────────────────────────
//  GET ALL USERS  (HQ Admin only)
// ─────────────────────────────────────────────

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  // Optional filters from query string
  if (req.query.role)     filter.role     = req.query.role;
  if (req.query.isActive) filter.isActive = req.query.isActive === 'true';

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate('branch', 'name location')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  sendPaginated(res, users, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET USER BY ID
// ─────────────────────────────────────────────

exports.getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .populate('branch', 'name location')
    .select('-password');

  if (!user) return next(new AppError('User not found.', 404));

  sendSuccess(res, 200, 'User retrieved', user);
});

// ─────────────────────────────────────────────
//  GET USERS BY BRANCH
// ─────────────────────────────────────────────

exports.getUsersByBranch = catchAsync(async (req, res, next) => {
  const { branchId } = req.params;
  const { page, limit, skip } = getPagination(req);

  const filter = { branch: branchId };
  if (req.query.role) filter.role = req.query.role;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  sendPaginated(res, users, total, page, limit);
});

// ─────────────────────────────────────────────
//  UPDATE USER
// ─────────────────────────────────────────────

exports.updateUser = catchAsync(async (req, res, next) => {
  // Disallow password changes through this route
  const { password, ...updates } = req.body;

  const before = await User.findById(req.params.id).select('-password');
  if (!before) return next(new AppError('User not found.', 404));

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new:           true,
    runValidators: true,
  })
    .populate('branch', 'name location')
    .select('-password');

  await createAuditLog({
    action:      'UPDATE_USER',
    entity:      'User',
    entityId:    user._id,
    performedBy: req.user._id,
    branch:      user.branch?._id,
    before:      before.toObject(),
    after:       user.toObject(),
    ipAddress:   req.ip,
    description: `${req.user.name} updated user ${user.name}`,
  });

  sendSuccess(res, 200, 'User updated successfully', user);
});

// ─────────────────────────────────────────────
//  DEACTIVATE USER  (soft delete)
// ─────────────────────────────────────────────

exports.deactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  if (user._id.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot deactivate your own account.', 400));
  }

  user.isActive = false;
  await user.save({ validateBeforeSave: false });

  await createAuditLog({
    action:      'DEACTIVATE_USER',
    entity:      'User',
    entityId:    user._id,
    performedBy: req.user._id,
    ipAddress:   req.ip,
    description: `${req.user.name} deactivated user ${user.name}`,
  });

  sendSuccess(res, 200, `User ${user.name} has been deactivated`);
});

// ─────────────────────────────────────────────
//  REACTIVATE USER
// ─────────────────────────────────────────────

exports.reactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  user.isActive = true;
  await user.save({ validateBeforeSave: false });

  await createAuditLog({
    action:      'REACTIVATE_USER',
    entity:      'User',
    entityId:    user._id,
    performedBy: req.user._id,
    ipAddress:   req.ip,
    description: `${req.user.name} reactivated user ${user.name}`,
  });

  sendSuccess(res, 200, `User ${user.name} has been reactivated`, user);
});