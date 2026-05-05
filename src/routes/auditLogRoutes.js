const express = require('express');
const router  = express.Router();

const { getAllLogs, getLogsByUser, getLogsByBranch } = require('../controllers/miscControllers');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All audit log routes are HQ Admin only — full accountability trail
router.use(protect);
router.use(restrictTo('hq_admin'));

router.get('/',                       getAllLogs);
router.get('/user/:userId',           getLogsByUser);
router.get('/branch/:branchId',       getLogsByBranch);

module.exports = router;