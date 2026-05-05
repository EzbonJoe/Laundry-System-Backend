const jwt = require('jsonwebtoken');
const  { User }  = require('../models/User');
const  Branch  = require('../models/Branch');
const  Customer  = require('../models/Customer');
const  Order  = require('../models/Order');
const  Payment  = require('../models/Payment');
const  InventoryItem  = require('../models/Inventory');

// ─────────────────────────────────────────────
//  TOKEN FACTORY
// ─────────────────────────────────────────────

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'test_secret_key_12345', { expiresIn: '1d' });

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ─────────────────────────────────────────────
//  SEED HELPERS
// ─────────────────────────────────────────────

const createBranch = async (overrides = {}) => {
  return Branch.create({
    name:     'Kampala Main',
    location: 'Kampala',
    address:  '1 Kampala Road',
    phone:    '+256700000001',
    ...overrides,
  });
};

const createUser = async (overrides = {}) => {
  const branch = overrides.branch || (await createBranch())._id;
  return User.create({
    name:     'Test Staff',
    email:    `staff_${Date.now()}@ezbon.com`,
    password: 'password1',
    role:     'staff',
    branch,
    ...overrides,
  });
};

const createHQAdmin = async () =>
  User.create({
    name:     'HQ Admin',
    email:    `admin_${Date.now()}@ezbon.com`,
    password: 'password1',
    role:     'hq_admin',
    branch:   null,
  });

const createBranchManager = async (branch) =>
  User.create({
    name:     'Branch Manager',
    email:    `manager_${Date.now()}@ezbon.com`,
    password: 'password1',
    role:     'branch_manager',
    branch:   branch._id,
  });

const createCustomer = async (branch, overrides = {}) =>
  Customer.create({
    name:   'Jane Doe',
    phone:  `+25670${Math.floor(1000000 + Math.random() * 9000000)}`,
    branch: branch._id,
    ...overrides,
  });

const createOrder = async (customer, branch, receivedBy, overrides = {}) =>
  Order.create({
    customer:  customer._id,
    branch:    branch._id,
    receivedBy: receivedBy._id,
    items: [
      {
        category:    'shirt',
        serviceType: 'wash',
        quantity:    2,
        unitPrice:   5000,
        subtotal:    10000,
      },
    ],
    totalAmount:      10000,
    amountPaid:       0,
    collectionType:   'pickup',
    statusHistory:    [{ status: 'received', changedBy: receivedBy._id }],
    ...overrides,
  });

const createPayment = async (order, customer, branch, receivedBy, overrides = {}) =>
  Payment.create({
    order:      order._id,
    customer:   customer._id,
    branch:     branch._id,
    amount:     order.totalAmount,
    method:     'cash',
    receivedBy: receivedBy._id,
    ...overrides,
  });

const createInventoryItem = async (branch, overrides = {}) =>
  InventoryItem.create({
    name:              'Omo Detergent',
    category:          'detergent',
    unit:              'kg',
    branch:            branch._id,
    currentStock:      20,
    minimumStockLevel: 5,
    ...overrides,
  });

// ─────────────────────────────────────────────
//  FULL SEEDED CONTEXT
//  Returns everything needed to run a test suite
// ─────────────────────────────────────────────

const seedContext = async () => {
  const branch  = await createBranch();
  const admin   = await createHQAdmin();
  const manager = await createBranchManager(branch);
  const staff   = await createUser({ branch: branch._id, role: 'staff' });
  const customer = await createCustomer(branch);

  return {
    branch,
    admin,
    manager,
    staff,
    customer,
    adminToken:   signToken(admin._id),
    managerToken: signToken(manager._id),
    staffToken:   signToken(staff._id),
  };
};

module.exports = {
  signToken,
  authHeader,
  createBranch,
  createUser,
  createHQAdmin,
  createBranchManager,
  createCustomer,
  createOrder,
  createPayment,
  createInventoryItem,
  seedContext,
};