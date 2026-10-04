const express = require('express');
const router = express.Router();
const { getMyNotifications, markAllNotificationsRead } = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, getMyNotifications);
router.patch('/mark-read', verifyToken, markAllNotificationsRead);

module.exports = router;
