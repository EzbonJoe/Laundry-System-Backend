const express = require('express');
const router  = express.Router();

const { 
  getMyNotifications, 
  markNotificationRead, 
  markAllRead,
  deleteNotification 
} = require('../controllers/miscControllers');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Every user manages only their own notifications
router.get('/',              getMyNotifications);
router.patch('/read-all',    markAllRead);
router.patch('/:id/read',    markNotificationRead);
router.delete('/:id',        deleteNotification);

module.exports = router;