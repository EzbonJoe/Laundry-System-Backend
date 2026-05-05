const  Customer  = require('../models/Customer');
const  Order  = require('../models/Order')
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');

// ─────────────────────────────────────────────
//  CREATE CUSTOMER
// ─────────────────────────────────────────────

exports.createCustomer = catchAsync(async (req, res, next) => {
  const { name, phone, email, address, notes } = req.body;

  // Assign to the staff member's branch automatically
  const branch = req.body.branch || req.user.branch?._id;
  if (!branch) return next(new AppError('Branch is required.', 400));

  // Prevent duplicate phone numbers per branch
  const existing = await Customer.findOne({ phone, branch });
  if (existing) {
    return next(new AppError('A customer with this phone number already exists at this branch.', 400));
  }

  const customer = await Customer.create({ name, phone, email, address, branch, notes });

  sendSuccess(res, 201, 'Customer created successfully', customer);
});

// ─────────────────────────────────────────────
//  GET ALL CUSTOMERS
// ─────────────────────────────────────────────

exports.getAllCustomers = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  if (req.query.loyaltyStatus) filter.loyaltyStatus = req.query.loyaltyStatus;

  // Search by name or phone
  if (req.query.search) {
    const regex = new RegExp(req.query.search, 'i');
    filter.$or = [{ name: regex }, { phone: regex }];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .populate('branch', 'name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    Customer.countDocuments(filter),
  ]);

  sendPaginated(res, customers, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET CUSTOMER BY ID
// ─────────────────────────────────────────────

exports.getCustomerById = catchAsync(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id).populate('branch', 'name location');
  if (!customer) return next(new AppError('Customer not found.', 404));

  sendSuccess(res, 200, 'Customer retrieved', customer);
});

// ─────────────────────────────────────────────
//  UPDATE CUSTOMER
// ─────────────────────────────────────────────

exports.updateCustomer = catchAsync(async (req, res, next) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new:           true,
    runValidators: true,
  }).populate('branch', 'name');

  if (!customer) return next(new AppError('Customer not found.', 404));

  sendSuccess(res, 200, 'Customer updated successfully', customer);
});

// ─────────────────────────────────────────────
//  GET CUSTOMER ORDER HISTORY
// ─────────────────────────────────────────────

exports.getCustomerOrderHistory = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);

  const customer = await Customer.findById(req.params.id);
  if (!customer) return next(new AppError('Customer not found.', 404));

  const filter = { customer: req.params.id };
  if (req.query.status) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('receivedBy', 'name')
      .populate('branch', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  sendPaginated(res, orders, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET LOYAL CUSTOMERS  (active + high spend)
// ─────────────────────────────────────────────

exports.getLoyalCustomers = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter, loyaltyStatus: 'active' };

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .populate('branch', 'name')
      .sort({ totalSpent: -1, totalOrders: -1 })
      .skip(skip)
      .limit(limit),
    Customer.countDocuments(filter),
  ]);

  sendPaginated(res, customers, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET INACTIVE CUSTOMERS
// ─────────────────────────────────────────────

exports.getInactiveCustomers = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);

  const thresholdDays = parseInt(process.env.INACTIVE_CUSTOMER_DAYS) || 90;
  const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  const filter = {
    ...req.branchFilter,
    $or: [
      { lastOrderDate: { $lt: cutoffDate } },
      { lastOrderDate: null },
    ],
  };

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .populate('branch', 'name')
      .sort({ lastOrderDate: 1 })
      .skip(skip)
      .limit(limit),
    Customer.countDocuments(filter),
  ]);

  sendPaginated(res, customers, total, page, limit);
});