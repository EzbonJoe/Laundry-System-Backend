const  Branch  = require('../models/Branch');
const  Order  = require('../models/Order'); 
const  Payment  = require('../models/Payment'); 
const  Expense  = require('../models/Expense'); 
const  { User }  = require('../models/User'); 
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');

// ─────────────────────────────────────────────
//  CREATE BRANCH
// ─────────────────────────────────────────────

exports.createBranch = catchAsync(async (req, res, next) => {
  const { name, location, address, phone, manager } = req.body;

  const branch = await Branch.create({ name, location, address, phone, manager });

  await createAuditLog({
    action:      'CREATE_BRANCH',
    entity:      'Branch',
    entityId:    branch._id,
    performedBy: req.user._id,
    after:       branch.toObject(),
    ipAddress:   req.ip,
    description: `${req.user.name} created branch ${branch.name}`,
  });

  sendSuccess(res, 201, 'Branch created successfully', branch);
});

// ─────────────────────────────────────────────
//  GET ALL BRANCHES
// ─────────────────────────────────────────────

exports.getAllBranches = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};

  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const [branches, total] = await Promise.all([
    Branch.find(filter)
      .populate('manager', 'name email phone')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    Branch.countDocuments(filter),
  ]);

  sendPaginated(res, branches, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET BRANCH BY ID
// ─────────────────────────────────────────────

exports.getBranchById = catchAsync(async (req, res, next) => {
  const branch = await Branch.findById(req.params.id).populate('manager', 'name email phone');
  if (!branch) return next(new AppError('Branch not found.', 404));

  sendSuccess(res, 200, 'Branch retrieved', branch);
});

// ─────────────────────────────────────────────
//  UPDATE BRANCH
// ─────────────────────────────────────────────

exports.updateBranch = catchAsync(async (req, res, next) => {
  const before = await Branch.findById(req.params.id);
  if (!before) return next(new AppError('Branch not found.', 404));

  const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
    new:           true,
    runValidators: true,
  }).populate('manager', 'name email');

  await createAuditLog({
    action:      'UPDATE_BRANCH',
    entity:      'Branch',
    entityId:    branch._id,
    performedBy: req.user._id,
    before:      before.toObject(),
    after:       branch.toObject(),
    ipAddress:   req.ip,
  });

  sendSuccess(res, 200, 'Branch updated successfully', branch);
});

// ─────────────────────────────────────────────
//  DEACTIVATE BRANCH
// ─────────────────────────────────────────────

exports.deactivateBranch = catchAsync(async (req, res, next) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) return next(new AppError('Branch not found.', 404));

  branch.isActive = false;
  await branch.save();

  await createAuditLog({
    action:      'DEACTIVATE_BRANCH',
    entity:      'Branch',
    entityId:    branch._id,
    performedBy: req.user._id,
    ipAddress:   req.ip,
    description: `${req.user.name} deactivated branch ${branch.name}`,
  });

  sendSuccess(res, 200, `Branch "${branch.name}" has been deactivated`);
});

// ─────────────────────────────────────────────
//  GET BRANCH STATS  (summary for dashboard)
// ─────────────────────────────────────────────

exports.getBranchStats = catchAsync(async (req, res, next) => {
  const branchId = req.params.id;

  const branch = await Branch.findById(branchId);
  if (!branch) return next(new AppError('Branch not found.', 404));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));

  const [
    totalOrders,
    ordersThisMonth,
    ordersToday,
    uncollectedOrders,
    revenueResult,
    revenueThisMonth,
    expensesThisMonth,
    staffCount,
  ] = await Promise.all([
    Order.countDocuments({ branch: branchId }),
    Order.countDocuments({ branch: branchId, createdAt: { $gte: startOfMonth } }),
    Order.countDocuments({ branch: branchId, createdAt: { $gte: startOfToday } }),
    Order.countDocuments({ branch: branchId, status: 'uncollected' }),

    Payment.aggregate([
      { $match: { branch: branch._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    Payment.aggregate([
      { $match: { branch: branch._id, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    Expense.aggregate([
      { $match: { branch: branch._id, date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    User.countDocuments({ branch: branchId, isActive: true }),
  ]);

  const totalRevenue      = revenueResult[0]?.total       || 0;
  const monthlyRevenue    = revenueThisMonth[0]?.total    || 0;
  const monthlyExpenses   = expensesThisMonth[0]?.total   || 0;
  const monthlyProfit     = monthlyRevenue - monthlyExpenses;

  sendSuccess(res, 200, 'Branch stats retrieved', {
    branch: { _id: branch._id, name: branch.name, location: branch.location },
    orders: { total: totalOrders, thisMonth: ordersThisMonth, today: ordersToday, uncollected: uncollectedOrders },
    finance: { totalRevenue, monthlyRevenue, monthlyExpenses, monthlyProfit },
    staff:   { active: staffCount },
  });
});