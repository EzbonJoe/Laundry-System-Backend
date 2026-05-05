const express = require('express');
const router  = express.Router();

const inventoryController = require('../controllers/inventoryController');
const { protect, restrictTo, restrictToBranch, injectBranchFilter } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  validateAddInventoryItem,
  validateUpdateStockLevel,
  validateLogStockUsage,
  validateRestockItem,
} = require('../validators/inventoryValidators');

router.use(protect);
router.use(injectBranchFilter);

// ── Special routes ────────────────────────────────────────────────────────────
router.get('/alerts/low-stock', inventoryController.getLowStockAlerts);
router.get('/report/usage',     inventoryController.getStockUsageReport);
router.get('/branch/:branchId', restrictToBranch, inventoryController.getInventoryByBranch);

// ── Standard list & create ────────────────────────────────────────────────────
router.get('/',  inventoryController.getAllInventory);
router.post('/', restrictTo('hq_admin', 'branch_manager'), validateAddInventoryItem, validateRequest, inventoryController.addInventoryItem);

// ── Per-item operations ───────────────────────────────────────────────────────
router.patch('/:id/stock',   restrictTo('hq_admin', 'branch_manager'), validateUpdateStockLevel, validateRequest, inventoryController.updateStockLevel);
router.post( '/:id/restock', restrictTo('hq_admin', 'branch_manager'), validateRestockItem,      validateRequest, inventoryController.restockItem);
router.post( '/:id/use',     validateLogStockUsage, validateRequest, inventoryController.logStockUsage);

module.exports = router;