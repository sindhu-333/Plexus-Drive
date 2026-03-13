const { pool } = require('../db');

class NotificationService {
  
  /**
   * Create a notification for a user
   * @param {number} userId - Target user ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
   * @param {string} actionType - Action type ('file_upload', 'file_share', etc.)
   * @param {Object} actionData - Additional data for the action
   * @param {Date} expiresAt - Optional expiration date
   */
  static async createNotification(userId, title, message, type = 'info', actionType = null, actionData = null, expiresAt = null) {
    try {
      const result = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, action_type, action_data, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          userId, 
          title, 
          message, 
          type, 
          actionType, 
          actionData ? JSON.stringify(actionData) : null, 
          expiresAt
        ]
      );

      console.log(`📢 Notification created for user ${userId}: ${title}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  // File upload notifications removed - not necessary for basic operations

  /**
   * Create file share notification
   */
  static async notifyFileShared(userId, fileName, fileId, sharedBy) {
    return this.createNotification(
      userId,
      'File Shared With You',
      `${sharedBy} shared "${fileName}" with you.`,
      'info',
      'file_share',
      { file_id: fileId, file_name: fileName, shared_by: sharedBy }
    );
  }

  /**
   * Create storage warning notification
   */
  static async notifyStorageWarning(userId, usedPercentage) {
    return this.createNotification(
      userId,
      'Storage Space Running Low',
      `Your storage is ${usedPercentage}% full. Consider deleting some files or upgrading your plan.`,
      'warning',
      'storage_warning',
      { used_percentage: usedPercentage },
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expire in 7 days
    );
  }

  // Folder creation notifications removed - not necessary for basic operations

  /**
   * Create analysis completion notification
   */
  static async notifyAnalysisComplete(userId, fileName, fileId, analysisType) {
    return this.createNotification(
      userId,
      'Analysis Complete',
      `AI analysis of "${fileName}" is now available.`,
      'info',
      'analysis_complete',
      { file_id: fileId, file_name: fileName, analysis_type: analysisType }
    );
  }

  /**
   * Create security alert notification
   */
  static async notifySecurityAlert(userId, alertType, message) {
    return this.createNotification(
      userId,
      'Security Alert',
      message,
      'warning',
      'security_alert',
      { alert_type: alertType }
    );
  }

  /**
   * Create failed login attempt notification
   */
  static async notifyFailedLogin(userId, ipAddress, location) {
    return this.createNotification(
      userId,
      'Failed Login Attempt',
      `Someone tried to access your account from ${location || 'unknown location'}.`,
      'warning',
      'failed_login',
      { ip_address: ipAddress, location: location }
    );
  }

  /**
   * Create system maintenance notification
   */
  static async notifySystemMaintenance(userId, maintenanceTime, duration) {
    return this.createNotification(
      userId,
      'Scheduled Maintenance',
      `System maintenance is scheduled for ${maintenanceTime}. Expected duration: ${duration}.`,
      'info',
      'system_maintenance',
      { maintenance_time: maintenanceTime, duration: duration }
    );
  }

  /**
   * Get user's notification preferences
   */
  static async getUserPreferences(userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default preferences - only important notifications enabled
        const defaultResult = await pool.query(
          `INSERT INTO notification_preferences (user_id, email_notifications, push_notifications, file_upload_notifications, share_notifications, storage_alerts)
           VALUES ($1, true, true, false, true, true)
           RETURNING *`,
          [userId]
        );
        return defaultResult.rows[0];
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {
        email_notifications: true,
        push_notifications: true,
        file_upload_notifications: true,
        share_notifications: true,
        storage_alerts: true
      };
    }
  }

  /**
   * Check if user should receive a specific type of notification
   */
  static async shouldNotify(userId, notificationType) {
    const preferences = await this.getUserPreferences(userId);
    
    switch (notificationType) {
      case 'file_upload':
        return preferences.file_upload_notifications;
      case 'file_share':
        return preferences.share_notifications;
      case 'storage_warning':
        return preferences.storage_alerts;
      default:
        return true; // Default to true for unknown types
    }
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpired() {
    try {
      const result = await pool.query(
        'DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP'
      );
      
      if (result.rowCount > 0) {
        console.log(`🧹 Cleaned up ${result.rowCount} expired notifications`);
      }
      
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId) {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
        [userId]
      );
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}

module.exports = NotificationService;