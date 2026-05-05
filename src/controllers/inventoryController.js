const  InventoryItem  = require('../models/Inventory');
const  StockUsageLog  = require('../models/StockUsageLog')
const  RestockLog  = require('../models/RestockLog');
const  Notification  = require('../models/Notification')
const  { User }  = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');
const { notifyLowStock } = require('../utils/notifications');

// ─────────────────────────────────────────────
//  ADD INVENTORY ITEM
// ─────────────────────────────────────────────

exports.addInventoryItem = catchAsync(async (req, res, next) => {
  const branch = req.body.branch || req.user.branch?._id;
  if (!branch) return next(new AppError('Branch is required.', 400));

  const item = await InventoryItem.create({ ...req.body, branch });

  await createAuditLog({
    action:      'ADD_INVENTORY_ITEM',
    entity:      'InventoryItem',
    entityId:    item._id,
    performedBy: req.user._id,
    branch,
    after:       item.toObject(),
    ipAddress:   req.ip,
  });

  sendSuccess(res, 201, 'Inventory item added', item);
});

// ─────────────────────────────────────────────
//  GET ALL INVENTORY
// ─────────────────────────────────────────────

exports.getAllInventory = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  if (req.query.category)   filter.category   = req.query.category;
  if (req.query.isLowStock) filter.isLowStock  = req.query.isLowStock === 'true';

  const [items, total] = await Promise.all([
    InventoryItem.find(filter)
      .populate('branch', 'name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    InventoryItem.countDocuments(filter),
  ]);

  sendPaginated(res, items, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET INVENTORY BY BRANCH
// ─────────────────────────────────────────────

exports.getInventoryByBranch = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { branch: req.params.branchId };

  if (req.query.category) filter.category = req.query.category;

  const [items, total] = await Promise.all([
    InventoryItem.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    InventoryItem.countDocuments(filter),
  ]);

  sendPaginated(res, items, total, page, limit);
});

// ─────────────────────────────────────────────
//  UPDATE STOCK LEVEL (manual adjustment)
// ─────────────────────────────────────────────

exports.updateStockLevel = catchAsync(async (req, res, next) => {
  const { currentStock, minimumStockLevel } = req.body;

  const before = await InventoryItem.findById(req.params.id);
  if (!before) return next(new AppError('Inventory item not found.', 404));

  const updates = {};
  if (currentStock      !== undefined) updates.currentStock      = currentStock;
  if (minimumStockLevel !== undefined) updates.minimumStockLevel = minimumStockLevel;

  const item = await InventoryItem.findByIdAndUpdate(req.params.id, updates, {
    new:           true,
    runValidators: true,
  }).populate('branch', 'name');

  await createAuditLog({
    action:      'UPDATE_STOCK_LEVEL',
    entity:      'InventoryItem',
    entityId:    item._id,
    performedBy: req.user._id,
    branch:      item.branch._id,
    before:      { currentStock: before.currentStock },
    after:       { currentStock: item.currentStock },
    ipAddress:   req.ip,
  });

  sendSuccess(res, 200, 'Stock level updated', item);
});

// ─────────────────────────────────────────────
//  LOG STOCK USAGE
// ─────────────────────────────────────────────

exports.logStockUsage = catchAsync(async (req, res, next) => {
  const { quantityUsed, orderId, notes } = req.body;
  const itemId = req.params.id;

  const item = await InventoryItem.findById(itemId);
  if (!item) return next(new AppError('Inventory item not found.', 404));

  if (item.currentStock < quantityUsed) {
    return next(
      new AppError(`Insufficient stock. Available: ${item.currentStock} ${item.unit}.`, 400)
    );
  }

  // Deduct stock
  item.currentStock -= quantityUsed;
  await item.save();

  const log = await StockUsageLog.create({
    item:         itemId,
    branch:       item.branch,
    order:        orderId || null,
    quantityUsed,
    usedBy:       req.user._id,
    notes,
  });

  // Check if stock is now low and send alert
  if (item.isLowStock) {
    const managers = await User.find({
      branch: item.branch,
      role:   { $in: ['branch_manager', 'hq_admin'] },
      isActive: true,
    });

    for (const manager of managers) {
      await Notification.create({
        type:            'low_stock',
        message:         `Low stock: "${item.name}" at branch is down to ${item.currentStock} ${item.unit}`,
        recipient:       manager._id,
        branch:          item.branch,
        relatedEntity:   'InventoryItem',
        relatedEntityId: item._id,
      });

      if (manager.email) {
        await notifyLowStock(manager.email, item.name, 'your branch', item.currentStock, item.unit);
      }
    }
  }

  sendSuccess(res, 201, 'Stock usage logged', { log, updatedItem: item });
});

// ─────────────────────────────────────────────
//  RESTOCK ITEM
// ─────────────────────────────────────────────

exports.restockItem = catchAsync(async (req, res, next) => {
  const { quantityAdded, supplier, cost, notes } = req.body;
  const itemId = req.params.id;

  const item = await InventoryItem.findById(itemId);
  if (!item) return next(new AppError('Inventory item not found.', 404));

  const before = item.currentStock;

  item.currentStock += quantityAdded;
  await item.save();

  const log = await RestockLog.create({
    item:          itemId,
    branch:        item.branch,
    quantityAdded,
    supplier,
    cost,
    restockedBy:   req.user._id,
    notes,
  });

  await createAuditLog({
    action:      'RESTOCK_ITEM',
    entity:      'InventoryItem',
    entityId:    item._id,
    performedBy: req.user._id,
    branch:      item.branch,
    before:      { currentStock: before },
    after:       { currentStock: item.currentStock },
    ipAddress:   req.ip,
    description: `${req.user.name} restocked "${item.name}" by ${quantityAdded} ${item.unit}`,
  });

  sendSuccess(res, 201, 'Item restocked successfully', { log, updatedItem: item });
});

// ─────────────────────────────────────────────
//  GET LOW STOCK ALERTS
// ─────────────────────────────────────────────

exports.getLowStockAlerts = catchAsync(async (req, res, next) => {
  const filter = { ...req.branchFilter, isLowStock: true };

  const items = await InventoryItem.find(filter)
    .populate('branch', 'name')
    .sort({ currentStock: 1 });

  sendSuccess(res, 200, `${items.length} low stock item(s) found`, items);
});

// ─────────────────────────────────────────────
//  GET STOCK USAGE REPORT
// ─────────────────────────────────────────────

exports.getStockUsageReport = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
  }

  const [logs, total] = await Promise.all([
    StockUsageLog.find(filter)
      .populate('item', 'name category unit')
      .populate('usedBy', 'name')
      .populate('branch', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StockUsageLog.countDocuments(filter),
  ]);

  sendPaginated(res, logs, total, page, limit);
});