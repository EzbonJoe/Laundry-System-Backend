const express = require('express');
const router  = express.Router();

const {
  submitFeedback,
  getFeedbackByBranch,
  getFeedbackByOrder,
  getAverageRating,
  markFeedbackReviewed,
} = require('../controllers/miscControllers');
const { protect, restrictTo, restrictToBranch, injectBranchFilter } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateSubmitFeedback } = require('../validators/feedbackValidators');

router.use(protect);
router.use(injectBranchFilter);

router.post('/',                validateSubmitFeedback, validateRequest, submitFeedback);
router.get('/ratings',          restrictTo('hq_admin', 'branch_manager'), getAverageRating);
router.get('/branch/:branchId', restrictTo('hq_admin', 'branch_manager'), restrictToBranch, getFeedbackByBranch);
router.get('/order/:orderId',   getFeedbackByOrder);
router.patch('/:id/reviewed',   restrictTo('hq_admin', 'branch_manager'), markFeedbackReviewed);

module.exports = router;