const express = require('express');
const router  = express.Router();

const paymentController = require('../controllers/paymentController');
const { protect, restrictTo, restrictToBranch, injectBranchFilter } = require('../middleware/authMiddleware');
const { audit } = require('../middleware/auditMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateRecordPayment, validateFlagPayment } = require('../validators/paymentValidators');

router.use(protect);
router.use(injectBranchFilter);

router.post('/',   validateRecordPayment, validateRequest, audit('RECORD_PAYMENT', 'Payment'), paymentController.recordPayment);
router.get('/',    paymentController.getAllPayments);
router.get('/order/:orderId',   paymentController.getPaymentsByOrder);
router.get('/branch/:branchId', restrictTo('hq_admin', 'branch_manager'), restrictToBranch, paymentController.getPaymentsByBranch);
router.get('/:id/receipt',      paymentController.generateReceipt);
router.patch('/:id/flag',       restrictTo('hq_admin', 'branch_manager'), validateFlagPayment, validateRequest, paymentController.flagPayment);

module.exports = router;