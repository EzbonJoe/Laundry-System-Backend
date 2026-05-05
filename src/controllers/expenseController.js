const  Expense  = require('../models/Expense');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');

exports.recordExpense = catchAsync(async (req, res, next) => {
  const branch = req.body.branch || req.user.branch?._id;
  if (!branch) return next(new AppError('Branch is required.', 400));

  const expense = await Expense.create({ ...req.body, branch, recordedBy: req.user._id });

  await createAuditLog({
    action: 'RECORD_EXPENSE', entity: 'Expense', entityId: expense._id,
    performedBy: req.user._id, branch, after: expense.toObject(), ipAddress: req.ip,
    description: `${req.user.name} recorded expense: ${expense.description} (${expense.amount})`,
  });

  sendSuccess(res, 201, 'Expense recorded', expense);
});

exports.getAllExpenses = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  if (req.query.category) filter.category = req.query.category;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to)   filter.date.$lte = new Date(req.query.to);
  }

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .populate('branch', 'name')
      .populate('recordedBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Expense.countDocuments(filter),
  ]);

  sendPaginated(res, expenses, total, page, limit);
});

exports.getExpensesByBranch = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { branch: req.params.branchId };

  if (req.query.category) filter.category = req.query.category;

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .populate('recordedBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Expense.countDocuments(filter),
  ]);

  sendPaginated(res, expenses, total, page, limit);
});

exports.getExpensesByCategory = catchAsync(async (req, res, next) => {
  const filter = { ...req.branchFilter };
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to)   filter.date.$lte = new Date(req.query.to);
  }

  const breakdown = await Expense.aggregate([
    { $match: filter },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  sendSuccess(res, 200, 'Expense breakdown by category', breakdown);
});

exports.deleteExpense = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return next(new AppError('Expense not found.', 404));

  await createAuditLog({
    action: 'DELETE_EXPENSE', entity: 'Expense', entityId: expense._id,
    performedBy: req.user._id, branch: expense.branch,
    before: expense.toObject(), ipAddress: req.ip,
    description: `${req.user.name} deleted expense: ${expense.description}`,
  });

  await expense.deleteOne();
  sendSuccess(res, 200, 'Expense deleted');
});