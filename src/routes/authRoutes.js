const express = require('express');
const router  = express.Router();

const authController = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  validateLogin,
  validateRegister,
  validateChangePassword,
  validateResetPassword,
} = require('../validators/authValidators');

// ── Public routes ────────────────────────────
router.post('/login',  validateLogin,  validateRequest, authController.login);
router.post('/logout', authController.logout);

// ── Protected routes (must be logged in) ────
router.use(protect);

router.get('/me', authController.getMe);
router.put('/change-password', validateChangePassword, validateRequest, authController.changePassword);

// ── HQ Admin only ────────────────────────────
router.post('/register',       restrictTo('hq_admin', 'branch_manager'), validateRegister,      validateRequest, authController.register);
router.post('/reset-password', restrictTo('hq_admin'),                   validateResetPassword, validateRequest, authController.resetPassword);

module.exports = router;