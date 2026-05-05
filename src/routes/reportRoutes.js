const express = require('express');
const router  = express.Router();

const reportController = require('../controllers/reportController');
const { protect, restrictTo, restrictToBranch, injectBranchFilter } = require('../middleware/authMiddleware');

router.use(protect);
router.use(injectBranchFilter);

// ── HQ-wide dashboard (HQ Admin only) ────────────────────────────────────────
router.get(
  '/dashboard',
  restrictTo('hq_admin'),
  reportController.getDashboardSummary
);

// ── Branch dashboard ──────────────────────────────────────────────────────────
router.get(
  '/dashboard/branch/:branchId',
  restrictTo('hq_admin', 'branch_manager'),
  restrictToBranch,
  reportController.getBranchDashboard
);

// ── Financial reports (managers and above) ────────────────────────────────────
router.get(
  '/revenue',
  restrictTo('hq_admin', 'branch_manager'),
  reportController.getRevenueReport
);

router.get(
  '/profit-loss',
  restrictTo('hq_admin', 'branch_manager'),
  reportController.getProfitLossReport
);

router.get(
  '/expenses',
  restrictTo('hq_admin', 'branch_manager'),
  reportController.getInventoryReport  // reuse inventory data in financial context
);

// ── Operational reports ───────────────────────────────────────────────────────
router.get(
  '/uncollected',
  restrictTo('hq_admin', 'branch_manager'),
  reportController.getUncollectedItemsReport
);

router.get(
  '/customers',
  restrictTo('hq_admin', 'branch_manager'),
  reportController.getCustomerReport
);

router.get(
  '/inventory',
  restrictTo('hq_admin', 'branch_manager'),
  reportController.getInventoryReport
);

router.get(
  '/staff-activity',
  restrictTo('hq_admin', 'branch_manager'),
  reportController.getStaffActivityReport
);

// ── Fraud / security report (HQ Admin only) ───────────────────────────────────
router.get(
  '/fraud-risk',
  restrictTo('hq_admin'),
  reportController.getFraudRiskReport
);

module.exports = router;