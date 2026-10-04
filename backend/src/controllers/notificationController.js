const { query, memoryStore } = require('../config/db');

/**
 * GET /api/notifications
 * Retrieves notifications for the currently authenticated user
 */
const getMyNotifications = async (req, res) => {
  try {
    const result = await query('SELECT * FROM notifications WHERE user_id = $1', [req.user.id]);
    const notifications = result.rows || [];
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return res.status(200).json({
      success: true,
      total: notifications.length,
      unread_count: unreadCount,
      data: notifications
    });
  } catch (err) {
    console.error('Error in getMyNotifications:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
};

/**
 * PATCH /api/notifications/mark-read
 * Marks all notifications as read for the user
 */
const markAllNotificationsRead = async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (err) {
    console.error('Error in markAllNotificationsRead:', err);
    return res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
};

module.exports = {
  getMyNotifications,
  markAllNotificationsRead
};
