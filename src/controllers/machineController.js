const  MachineUsageLog  = require('../models/MachineUsageLog');
const  Machine  = require('../models/Machine')
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');

// ─────────────────────────────────────────────
//  ADD MACHINE
// ─────────────────────────────────────────────

exports.addMachine = catchAsync(async (req, res, next) => {
  const branch = req.body.branch || req.user.branch?._id;
  if (!branch) return next(new AppError('Branch is required.', 400));

  const machine = await Machine.create({ ...req.body, branch });

  await createAuditLog({
    action: 'ADD_MACHINE', entity: 'Machine', entityId: machine._id,
    performedBy: req.user._id, branch, after: machine.toObject(), ipAddress: req.ip,
  });

  sendSuccess(res, 201, 'Machine added', machine);
});

// ─────────────────────────────────────────────
//  GET ALL MACHINES
// ─────────────────────────────────────────────

exports.getAllMachines = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { ...req.branchFilter };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.type)   filter.type   = req.query.type;

  const [machines, total] = await Promise.all([
    Machine.find(filter).populate('branch', 'name').sort({ name: 1 }).skip(skip).limit(limit),
    Machine.countDocuments(filter),
  ]);

  sendPaginated(res, machines, total, page, limit);
});

// ─────────────────────────────────────────────
//  GET MACHINES BY BRANCH
// ─────────────────────────────────────────────

exports.getMachinesByBranch = catchAsync(async (req, res, next) => {
  const machines = await Machine.find({ branch: req.params.branchId }).sort({ name: 1 });
  sendSuccess(res, 200, 'Machines retrieved', machines);
});

// ─────────────────────────────────────────────
//  UPDATE MACHINE STATUS
// ─────────────────────────────────────────────

exports.updateMachineStatus = catchAsync(async (req, res, next) => {
  const { status, lastMaintenanceDate, nextMaintenanceDue, notes } = req.body;

  const machine = await Machine.findById(req.params.id);
  if (!machine) return next(new AppError('Machine not found.', 404));

  const before = machine.toObject();

  if (status)               machine.status               = status;
  if (lastMaintenanceDate)  machine.lastMaintenanceDate  = lastMaintenanceDate;
  if (nextMaintenanceDue)   machine.nextMaintenanceDue   = nextMaintenanceDue;
  if (notes)                machine.notes                = notes;

  await machine.save();

  await createAuditLog({
    action: 'UPDATE_MACHINE_STATUS', entity: 'Machine', entityId: machine._id,
    performedBy: req.user._id, branch: machine.branch,
    before: { status: before.status }, after: { status: machine.status },
    ipAddress: req.ip,
  });

  sendSuccess(res, 200, 'Machine updated', machine);
});

// ─────────────────────────────────────────────
//  LOG MACHINE USAGE
// ─────────────────────────────────────────────

exports.logMachineUsage = catchAsync(async (req, res, next) => {
  const { orderId, startTime, endTime, notes } = req.body;
  const machineId = req.params.id;

  const machine = await Machine.findById(machineId);
  if (!machine) return next(new AppError('Machine not found.', 404));

  if (machine.status === 'out_of_service') {
    return next(new AppError('This machine is out of service.', 400));
  }

  const log = await MachineUsageLog.create({
    machine:    machineId,
    order:      orderId,
    operatedBy: req.user._id,
    startTime,
    endTime:    endTime || null,
  });

  // Mark machine as in_use if no end time
  if (!endTime) {
    machine.status = 'in_use';
    await machine.save();
  }

  sendSuccess(res, 201, 'Machine usage logged', log);
});

// ─────────────────────────────────────────────
//  GET MACHINE USAGE HISTORY
// ─────────────────────────────────────────────

exports.getMachineUsageHistory = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req);

  const [logs, total] = await Promise.all([
    MachineUsageLog.find({ machine: req.params.id })
      .populate('order', 'orderNumber')
      .populate('operatedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MachineUsageLog.countDocuments({ machine: req.params.id }),
  ]);

  sendPaginated(res, logs, total, page, limit);
});