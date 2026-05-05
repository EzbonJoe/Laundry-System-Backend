const express = require('express');
const router  = express.Router();

const userController = require('../controllers/userController');
const { protect, restrictTo, injectBranchFilter } = require('../middleware/authMiddleware');

// All user routes require authentication
router.use(protect);

// ── HQ Admin only ─────────────────────────────────────────────────────────────
router.get(
  '/',
  restrictTo('hq_admin'),
  injectBranchFilter,
  userController.getAllUsers
);

router.delete(
  '/:id',
  restrictTo('hq_admin'),
  userController.deactivateUser
);

router.patch(
  '/:id/reactivate',
  restrictTo('hq_admin'),
  userController.reactivateUser
);

// ── HQ Admin + Branch Manager ─────────────────────────────────────────────────
router.get(
  '/branch/:branchId',
  restrictTo('hq_admin', 'branch_manager'),
  userController.getUsersByBranch
);

router.put(
  '/:id',
  restrictTo('hq_admin', 'branch_manager'),
  userController.updateUser
);

// ── Any authenticated user ────────────────────────────────────────────────────
router.get('/:id', userController.getUserById);

module.exports = router;