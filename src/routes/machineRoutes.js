const express = require('express');
const router  = express.Router();

const machineController = require('../controllers/machineController');
const { protect, restrictTo, restrictToBranch, injectBranchFilter } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  validateAddMachine,
  validateUpdateMachineStatus,
  validateLogMachineUsage,
} = require('../validators/machineValidators');

router.use(protect);
router.use(injectBranchFilter);

router.get('/',  machineController.getAllMachines);
router.post('/', restrictTo('hq_admin', 'branch_manager'), validateAddMachine, validateRequest, machineController.addMachine);

router.get('/branch/:branchId', restrictToBranch, machineController.getMachinesByBranch);

router.patch('/:id/status',  restrictTo('hq_admin', 'branch_manager'), validateUpdateMachineStatus, validateRequest, machineController.updateMachineStatus);
router.post( '/:id/usage',   validateLogMachineUsage, validateRequest, machineController.logMachineUsage);
router.get(  '/:id/history', machineController.getMachineUsageHistory);

module.exports = router;