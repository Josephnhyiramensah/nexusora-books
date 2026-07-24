const express = require('express');
const router = express.Router();
const { protect, allow } = require('../middleware/authMiddleware');
const {
  getNotifications, getUnreadCount, createNotification,
  markRead, markAllRead, deleteNotification,
} = require('../controllers/notificationController');

router.use(protect);

// Reading your own feed is open to every authenticated user. What comes back is
// filtered by the query in the controller, not by the route.
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

// Sending is admin-level, or granted to an individual via notifications.send.
router.post('/', allow('notifications.send', 'super_admin', 'admin'), createNotification);
router.delete('/:id', allow('notifications.send', 'super_admin', 'admin'), deleteNotification);

module.exports = router;
