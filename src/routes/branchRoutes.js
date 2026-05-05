const express = require('express');
const router  = express.Router();

const branchController = require('../controllers/branchController');
const { protect, restrictTo, restrictToBranch } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateCreateBranch, validateUpdateBranch } = require('../validators/branchValidators');

router.use(protect);

// ── HQ Admin only ─────────────────────────────────────────────────────────────
router.post(
  '/',
  restrictTo('hq_admin'),
  validateCreateBranch, validateRequest,
  branchController.createBranch
);

router.delete(
  '/:id',
  restrictTo('hq_admin'),
  branchController.deactivateBranch
);

// ── HQ Admin + Branch Manager ─────────────────────────────────────────────────
router.put(
  '/:id',
  restrictTo('hq_admin', 'branch_manager'),
  validateUpdateBranch, validateRequest,
  branchController.updateBranch
);

router.get(
  '/:id/stats',
  restrictTo('hq_admin', 'branch_manager'),
  restrictToBranch,
  branchController.getBranchStats
);

// ── All authenticated users ───────────────────────────────────────────────────
router.get('/',    branchController.getAllBranches);
router.get('/:id', branchController.getBranchById);

module.exports = router;