const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Get all notifications for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only = false } = req.query;

    let query = `
      SELECT id, title, message, type, action_type, action_data, is_read, created_at, read_at, expires_at
      FROM notifications 
      WHERE user_id = $1
    `;
    
    const params = [userId];

    if (unread_only === 'true') {
      query += ' AND is_read = false';
    }

    // Don't show expired notifications
    query += ' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)';
    
    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Also get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
      [userId]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(unreadResult.rows[0].unread_count),
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read', notification: result.rows[0] });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read', error: error.message });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = false RETURNING COUNT(*)',
      [userId]
    );

    res.json({ 
      message: 'All notifications marked as read',
      updated_count: result.rowCount
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read', error: error.message });
  }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Failed to delete notification', error: error.message });
  }
});

// Clear all notifications (delete read ones, mark unread as read)
router.delete('/clear-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete read notifications
    const deleteResult = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = true',
      [userId]
    );

    // Mark unread as read
    const updateResult = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({ 
      message: 'All notifications cleared',
      deleted_count: deleteResult.rowCount,
      marked_read_count: updateResult.rowCount
    });

  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ message: 'Failed to clear notifications', error: error.message });
  }
});

// Create notification (internal use or admin)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      user_id, 
      title, 
      message, 
      type = 'info', 
      action_type, 
      action_data,
      expires_at 
    } = req.body;

    const targetUserId = user_id || req.user.id;

    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, action_type, action_data, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [targetUserId, title, message, type, action_type, action_data ? JSON.stringify(action_data) : null, expires_at]
    );

    res.status(201).json({ 
      message: 'Notification created successfully',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ message: 'Failed to create notification', error: error.message });
  }
});

// Get notification preferences
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default preferences if none exist
      const defaultPrefs = await pool.query(
        `INSERT INTO notification_preferences (user_id, email_notifications, push_notifications, file_upload_notifications, share_notifications, storage_alerts)
         VALUES ($1, true, true, true, true, true)
         RETURNING *`,
        [userId]
      );
      return res.json(defaultPrefs.rows[0]);
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ message: 'Failed to fetch notification preferences', error: error.message });
  }
});

// Test endpoint to create sample notifications
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Create a few test notifications
    const notifications = [
      {
        title: 'Security Alert',
        message: 'Failed login attempt from 192.168.1.100',
        type: 'warning',
        action_type: 'failed_login'
      },
      {
        title: 'Storage Warning', 
        message: 'Your storage is 85% full. Consider deleting some files.',
        type: 'warning',
        action_type: 'storage_warning'
      },
      {
        title: 'System Maintenance',
        message: 'Scheduled maintenance will occur tonight from 2-4 AM.',
        type: 'info', 
        action_type: 'system_maintenance'
      },
      {
        title: 'Analysis Complete',
        message: 'AI analysis completed for document.pdf',
        type: 'success',
        action_type: 'analysis_complete'
      }
    ];

    const createdNotifications = [];
    for (const notif of notifications) {
      const result = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, action_type, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, notif.title, notif.message, notif.type, notif.action_type]
      );
      createdNotifications.push(result.rows[0]);
    }

    res.json({ 
      message: 'Test notifications created successfully',
      notifications: createdNotifications
    });

  } catch (error) {
    console.error('Create test notifications error:', error);
    res.status(500).json({ message: 'Failed to create test notifications', error: error.message });
  }
});

// Update notification preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      email_notifications,
      push_notifications, 
      file_upload_notifications,
      share_notifications,
      storage_alerts
    } = req.body;

    const result = await pool.query(
      `INSERT INTO notification_preferences (user_id, email_notifications, push_notifications, file_upload_notifications, share_notifications, storage_alerts, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         email_notifications = $2,
         push_notifications = $3,
         file_upload_notifications = $4,
         share_notifications = $5,
         storage_alerts = $6,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, email_notifications, push_notifications, file_upload_notifications, share_notifications, storage_alerts]
    );

    res.json({ 
      message: 'Notification preferences updated successfully',
      preferences: result.rows[0]
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ message: 'Failed to update notification preferences', error: error.message });
  }
});

module.exports = router;