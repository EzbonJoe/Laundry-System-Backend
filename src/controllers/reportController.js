const mongoose = require('mongoose');
const  { User }  = require('../models/User');
const  Payment  = require('../models/Payment');
const  Customer  = require('../models/Customer');
const  Order  = require('../models/Order');
const  InventoryItem  = require('../models/Inventory');
const  Branch  = require('../models/Branch');
const  Expense  = require('../models/Expense');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/apiResponse');

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const getDateRange = (req) => {
  const now = new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = req.query.to   ? new Date(req.query.to)   : now;
  return { from, to };
};

// ─────────────────────────────────────────────
//  HQ DASHBOARD SUMMARY  (all branches)
// ─────────────────────────────────────────────

exports.getDashboardSummary = catchAsync(async (req, res, next) => {
  const { from, to } = getDateRange(req);

  const [
    totalBranches,
    activeBranches,
    totalOrders,
    ordersInRange,
    pendingOrders,
    uncollectedOrders,
    revenueAll,
    revenueInRange,
    expensesInRange,
    totalCustomers,
    activeCustomers,
    lowStockCount,
    revenueByBranch,
    ordersByStatus,
  ] = await Promise.all([
    Branch.countDocuments(),
    Branch.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: from, $lte: to } }),
    Order.countDocuments({ status: { $in: ['received', 'washing', 'ironing', 'packaging'] } }),
    Order.countDocuments({ status: { $in: ['ready', 'uncollected'] } }),

    Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    Customer.countDocuments(),
    Customer.countDocuments({ loyaltyStatus: 'active' }),
    InventoryItem.countDocuments({ isLowStock: true }),

    // Revenue grouped by branch
    Payment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$branch', revenue: { $sum: '$amount' } } },
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { branchName: '$branch.name', revenue: 1 } },
      { $sort: { revenue: -1 } },
    ]),

    // Orders grouped by status
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const totalRevenue   = revenueAll[0]?.total       || 0;
  const periodRevenue  = revenueInRange[0]?.total   || 0;
  const periodExpenses = expensesInRange[0]?.total  || 0;

  sendSuccess(res, 200, 'HQ Dashboard Summary', {
    period: { from, to },
    branches:  { total: totalBranches, active: activeBranches },
    orders:    { total: totalOrders, inPeriod: ordersInRange, pending: pendingOrders, uncollected: uncollectedOrders },
    finance:   { totalRevenue, periodRevenue, periodExpenses, periodProfit: periodRevenue - periodExpenses },
    customers: { total: totalCustomers, active: activeCustomers },
    inventory: { lowStockAlerts: lowStockCount },
    charts:    { revenueByBranch, ordersByStatus },
  });
});

// ─────────────────────────────────────────────
//  BRANCH DASHBOARD
// ─────────────────────────────────────────────

exports.getBranchDashboard = catchAsync(async (req, res, next) => {
  const branchId = new mongoose.Types.ObjectId(req.params.branchId);
  const { from, to } = getDateRange(req);

  const [
    totalOrders, ordersToday, pendingOrders, uncollectedOrders,
    revenue, expenses, lowStock,
    ordersByStatus, revenueByDay,
  ] = await Promise.all([
    Order.countDocuments({ branch: branchId }),
    Order.countDocuments({ branch: branchId, createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
    Order.countDocuments({ branch: branchId, status: { $in: ['received','washing','ironing','packaging'] } }),
    Order.countDocuments({ branch: branchId, status: { $in: ['ready','uncollected'] } }),

    Payment.aggregate([
      { $match: { branch: branchId, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { branch: branchId, date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    InventoryItem.countDocuments({ branch: branchId, isLowStock: true }),

    Order.aggregate([
      { $match: { branch: branchId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Daily revenue trend
    Payment.aggregate([
      { $match: { branch: branchId, createdAt: { $gte: from, $lte: to } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$amount' },
        transactions: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),
  ]);

  sendSuccess(res, 200, 'Branch Dashboard', {
    period: { from, to },
    orders: { total: totalOrders, today: ordersToday, pending: pendingOrders, uncollected: uncollectedOrders },
    finance: { revenue: revenue[0]?.total || 0, expenses: expenses[0]?.total || 0, profit: (revenue[0]?.total || 0) - (expenses[0]?.total || 0) },
    inventory: { lowStockAlerts: lowStock },
    charts: { ordersByStatus, revenueByDay },
  });
});

// ─────────────────────────────────────────────
//  REVENUE REPORT
// ─────────────────────────────────────────────

exports.getRevenueReport = catchAsync(async (req, res, next) => {
  const { from, to } = getDateRange(req);
  const matchFilter = { createdAt: { $gte: from, $lte: to }, ...req.branchFilter };

  const [byBranch, byMethod, byDay, total] = await Promise.all([
    Payment.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$branch', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { branchName: '$branch.name', revenue: 1, count: 1 } },
      { $sort: { revenue: -1 } },
    ]),
    Payment.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: matchFilter },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$amount' },
      }},
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  sendSuccess(res, 200, 'Revenue Report', {
    period: { from, to },
    totalRevenue: total[0]?.total || 0,
    byBranch, byMethod, byDay,
  });
});

// ─────────────────────────────────────────────
//  PROFIT / LOSS REPORT
// ─────────────────────────────────────────────

exports.getProfitLossReport = catchAsync(async (req, res, next) => {
  const { from, to } = getDateRange(req);
  const branchFilter = req.branchFilter;

  const [revenue, expenseBreakdown] = await Promise.all([
    Payment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, ...branchFilter } },
      { $group: { _id: '$branch', revenue: { $sum: '$amount' } } },
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { branchName: '$branch.name', revenue: 1 } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: from, $lte: to }, ...branchFilter } },
      { $group: { _id: '$branch', expenses: { $sum: '$amount' }, breakdown: { $push: { category: '$category', amount: '$amount' } } } },
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { branchName: '$branch.name', expenses: 1 } },
    ]),
  ]);

  // Merge revenue and expenses per branch
  const summary = revenue.map((r) => {
    const expEntry = expenseBreakdown.find((e) => e._id.toString() === r._id.toString());
    const expenses = expEntry?.expenses || 0;
    return {
      branch:   r.branchName,
      revenue:  r.revenue,
      expenses,
      profit:   r.revenue - expenses,
      margin:   r.revenue > 0 ? (((r.revenue - expenses) / r.revenue) * 100).toFixed(1) + '%' : '0%',
    };
  });

  const totals = summary.reduce((acc, b) => ({
    revenue:  acc.revenue  + b.revenue,
    expenses: acc.expenses + b.expenses,
    profit:   acc.profit   + b.profit,
  }), { revenue: 0, expenses: 0, profit: 0 });

  sendSuccess(res, 200, 'Profit & Loss Report', { period: { from, to }, byBranch: summary, totals });
});

// ─────────────────────────────────────────────
//  CUSTOMER REPORT
// ─────────────────────────────────────────────

exports.getCustomerReport = catchAsync(async (req, res, next) => {
  const filter = { ...req.branchFilter };

  const [total, active, inactive, topSpenders, newThisMonth] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.countDocuments({ ...filter, loyaltyStatus: 'active' }),
    Customer.countDocuments({ ...filter, loyaltyStatus: 'inactive' }),
    Customer.find(filter).sort({ totalSpent: -1 }).limit(10).populate('branch', 'name'),
    Customer.countDocuments({
      ...filter,
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    }),
  ]);

  sendSuccess(res, 200, 'Customer Report', { total, active, inactive, newThisMonth, topSpenders });
});

// ─────────────────────────────────────────────
//  UNCOLLECTED ITEMS REPORT
// ─────────────────────────────────────────────

exports.getUncollectedItemsReport = catchAsync(async (req, res, next) => {
  const thresholdDays = parseInt(process.env.UNCOLLECTED_ORDER_DAYS) || 7;
  const cutoffDate    = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  const filter = {
    ...req.branchFilter,
    status: { $in: ['ready', 'uncollected'] },
    expectedReadyDate: { $lt: cutoffDate },
  };

  const orders = await Order.find(filter)
    .populate('customer', 'name phone')
    .populate('branch', 'name')
    .sort({ expectedReadyDate: 1 });

  const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0);

  sendSuccess(res, 200, 'Uncollected Items Report', {
    count: orders.length, totalOutstandingValue: totalValue, orders,
  });
});

// ─────────────────────────────────────────────
//  STAFF ACTIVITY REPORT
// ─────────────────────────────────────────────

exports.getStaffActivityReport = catchAsync(async (req, res, next) => {
  const { from, to } = getDateRange(req);
  const branchFilter = req.branchFilter;

  const [ordersByStaff, paymentsByStaff] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, ...branchFilter } },
      { $group: { _id: '$receivedBy', ordersReceived: { $sum: 1 }, totalValue: { $sum: '$totalAmount' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff' } },
      { $unwind: '$staff' },
      { $project: { staffName: '$staff.name', ordersReceived: 1, totalValue: 1 } },
      { $sort: { ordersReceived: -1 } },
    ]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, ...branchFilter } },
      { $group: { _id: '$receivedBy', paymentsCollected: { $sum: 1 }, totalCollected: { $sum: '$amount' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff' } },
      { $unwind: '$staff' },
      { $project: { staffName: '$staff.name', paymentsCollected: 1, totalCollected: 1 } },
    ]),
  ]);

  sendSuccess(res, 200, 'Staff Activity Report', { period: { from, to }, ordersByStaff, paymentsByStaff });
});

// ─────────────────────────────────────────────
//  FRAUD RISK REPORT
// ─────────────────────────────────────────────

exports.getFraudRiskReport = catchAsync(async (req, res, next) => {
  const { from, to } = getDateRange(req);

  const [flaggedPayments, underpaidOrders] = await Promise.all([
    Payment.find({ isFlagged: true, createdAt: { $gte: from, $lte: to }, ...req.branchFilter })
      .populate('order', 'orderNumber totalAmount')
      .populate('customer', 'name phone')
      .populate('receivedBy', 'name')
      .populate('branch', 'name')
      .sort({ createdAt: -1 }),

    Order.find({
      paymentStatus: { $in: ['unpaid', 'partial'] },
      status: 'collected',
      ...req.branchFilter,
    })
      .populate('customer', 'name phone')
      .populate('branch', 'name')
      .populate('collectedBy', 'name'),
  ]);

  sendSuccess(res, 200, 'Fraud Risk Report', {
    period: { from, to },
    flaggedPayments: { count: flaggedPayments.length, records: flaggedPayments },
    collectedWithoutFullPayment: { count: underpaidOrders.length, records: underpaidOrders },
  });
});

// ─────────────────────────────────────────────
//  INVENTORY REPORT
// ─────────────────────────────────────────────

exports.getInventoryReport = catchAsync(async (req, res, next) => {
  const filter = { ...req.branchFilter };

  const [items, usageByItem] = await Promise.all([
    InventoryItem.find(filter).populate('branch', 'name').sort({ isLowStock: -1, name: 1 }),

    require('../models/StockUsageLog').StockUsageLog
      ? require('../models/StockUsageLog').StockUsageLog.aggregate([
          { $match: filter },
          { $group: { _id: '$item', totalUsed: { $sum: '$quantityUsed' }, usageCount: { $sum: 1 } } },
          { $lookup: { from: 'inventoryitems', localField: '_id', foreignField: '_id', as: 'item' } },
          { $unwind: '$item' },
          { $project: { itemName: '$item.name', unit: '$item.unit', totalUsed: 1, usageCount: 1 } },
          { $sort: { totalUsed: -1 } },
        ])
      : [],
  ]);

  const lowStockItems = items.filter((i) => i.isLowStock);

  sendSuccess(res, 200, 'Inventory Report', {
    totalItems: items.length,
    lowStockCount: lowStockItems.length,
    items,
    topUsedItems: usageByItem.slice(0, 10),
  });
});