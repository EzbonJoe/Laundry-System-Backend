const express = require('express');
const router  = express.Router();

const expenseController = require('../controllers/expenseController');
const { protect, restrictTo, restrictToBranch, injectBranchFilter } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateRecordExpense } = require('../validators/expenseValidators');

router.use(protect);
router.use(restrictTo('hq_admin', 'branch_manager'));
router.use(injectBranchFilter);

router.get('/by-category',      expenseController.getExpensesByCategory);
router.get('/',                 expenseController.getAllExpenses);
router.post('/',                validateRecordExpense, validateRequest, expenseController.recordExpense);
router.get('/branch/:branchId', restrictToBranch, expenseController.getExpensesByBranch);
router.delete('/:id',           restrictTo('hq_admin'), expenseController.deleteExpense);

module.exports = router;