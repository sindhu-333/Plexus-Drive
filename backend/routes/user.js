const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");
const emailService = require("../services/emailService");
const { uploadFileAndGetUrl } = require("../utils/dropbox");

const router = express.Router();

/* -----------------------
   User Profile routes
   ----------------------- */

// Get current user profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user profile data (using actual database columns)
    const userResult = await pool.query(
      `SELECT id, name, email, profile_picture, bio, phone, date_of_birth, 
              location, theme, language, timezone, email_notifications, 
              storage_limit, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const profile = userResult.rows[0];
    res.json(profile);
    
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
});

// Update user profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, 
      bio, 
      phone, 
      date_of_birth, 
      location, 
      theme, 
      language, 
      timezone, 
      email_notifications 
    } = req.body;
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    if (bio !== undefined) {
      updateFields.push(`bio = $${paramCount}`);
      values.push(bio);
      paramCount++;
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }
    if (date_of_birth !== undefined) {
      updateFields.push(`date_of_birth = $${paramCount}`);
      values.push(date_of_birth);
      paramCount++;
    }
    if (location !== undefined) {
      updateFields.push(`location = $${paramCount}`);
      values.push(location);
      paramCount++;
    }
    if (theme !== undefined) {
      updateFields.push(`theme = $${paramCount}`);
      values.push(theme);
      paramCount++;
    }
    if (language !== undefined) {
      updateFields.push(`language = $${paramCount}`);
      values.push(language);
      paramCount++;
    }
    if (timezone !== undefined) {
      updateFields.push(`timezone = $${paramCount}`);
      values.push(timezone);
      paramCount++;
    }
    if (email_notifications !== undefined) {
      updateFields.push(`email_notifications = $${paramCount}`);
      values.push(email_notifications);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }
    
    // Add user ID as last parameter
    values.push(userId);
    
    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, name, email, profile_picture, bio, phone, date_of_birth, 
                location, theme, language, timezone, email_notifications, 
                storage_limit, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (!result.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({ 
      message: "Profile updated successfully", 
      user: result.rows[0] 
    });
    
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Failed to update profile", error: err.message });
  }
});

// Update user settings
router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;
    
    // Update each setting
    const promises = Object.entries(settings).map(([key, value]) => {
      return pool.query(
        `INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, setting_key) 
         DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, key, value]
      );
    });
    
    await Promise.all(promises);
    
    res.json({ message: "Settings updated successfully" });
    
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ message: "Failed to update settings", error: err.message });
  }
});

// Change password
router.put("/password", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }
    
    // Get current password hash
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedNewPassword, userId]
    );
    
    // Send password change confirmation email
    try {
      const userResult = await pool.query("SELECT email, name FROM users WHERE id = $1", [userId]);
      const user = userResult.rows[0];
      
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const timestamp = new Date().toLocaleString();
      
      await emailService.sendPasswordChangeConfirmation(
        user.email,
        user.name,
        timestamp,
        ipAddress,
        'Unknown location' // Could integrate with IP geolocation service
      );
    } catch (emailError) {
      console.error('Failed to send password change email:', emailError);
      // Don't fail the password change if email fails
    }
    
    res.json({ message: "Password updated successfully" });
    
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Failed to change password", error: err.message });
  }
});

// Update email
router.put("/email", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    
    // Check if email already exists
    const emailExistsResult = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [email, userId]
    );
    
    if (emailExistsResult.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }
    
    // Verify password
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(400).json({ message: "Password is incorrect" });
    }
    
    // Get old email before updating
    const oldEmailResult = await pool.query("SELECT email, name FROM users WHERE id = $1", [userId]);
    const oldEmail = oldEmailResult.rows[0].email;
    const userName = oldEmailResult.rows[0].name;
    
    // Update email
    const result = await pool.query(
      "UPDATE users SET email = $1 WHERE id = $2 RETURNING email",
      [email, userId]
    );
    
    // Send email change notification to OLD email address
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const timestamp = new Date().toLocaleString();
      
      await emailService.sendEmailChangeConfirmation(
        oldEmail,
        email,
        userName,
        timestamp,
        ipAddress,
        'Unknown location' // Could integrate with IP geolocation service
      );
    } catch (emailError) {
      console.error('Failed to send email change notification:', emailError);
      // Don't fail the email change if notification email fails
    }
    
    res.json({
      message: "Email updated successfully",
      email: result.rows[0].email
    });
    
  } catch (err) {
    console.error("Update email error:", err);
    res.status(500).json({ message: "Failed to update email", error: err.message });
  }
});

// Get user statistics
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT 
         COUNT(f.id) as total_files,
         COALESCE(SUM(f.filesize), 0) as total_storage,
         COUNT(CASE WHEN f.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as files_this_week,
         COUNT(CASE WHEN f.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as files_this_month,
         COUNT(s.id) as shared_files,
         COUNT(ff.id) as favorite_files
       FROM users u
       LEFT JOIN files f ON u.id = f.user_id
       LEFT JOIN shares s ON f.id = s.file_id
       LEFT JOIN file_favorites ff ON f.id = ff.file_id AND ff.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );
    
    const stats = result.rows[0] || {
      total_files: 0,
      total_storage: 0,
      files_this_week: 0,
      files_this_month: 0,
      shared_files: 0,
      favorite_files: 0
    };
    
    // Convert string counts to integers
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]) || 0;
    });
    
    res.json(stats);
    
  } catch (err) {
    console.error("Get user stats error:", err);
    res.status(500).json({ message: "Failed to fetch user stats", error: err.message });
  }
});

// Upload profile picture
router.post("/profile-picture", authMiddleware, upload.single("profilePicture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No profile picture uploaded" });
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '..', 'uploads', 'profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Upload to Dropbox and get a permanent public URL
    const fileExtension = path.extname(req.file.originalname) || '.jpg';
    const dropboxPath = `/profiles/profile_${req.user.id}_${Date.now()}${fileExtension}`;

    const publicUrl = await uploadFileAndGetUrl(dropboxPath, req.file.buffer);

    // Update database with the public Dropbox URL
    const result = await pool.query(
      "UPDATE users SET profile_picture = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING profile_picture",
      [publicUrl, req.user.id]
    );
    
    res.json({ 
      message: "Profile picture uploaded successfully", 
      profile_picture: result.rows[0].profile_picture 
    });
    
  } catch (err) {
    console.error("Upload profile picture error:", err);
    res.status(500).json({ message: "Failed to upload profile picture", error: err.message });
  }
});

// Get user storage usage stats
router.get("/storage-stats", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         u.storage_limit,
         COALESCE(SUM(f.filesize), 0) as used_storage,
         COUNT(f.id) as total_files
       FROM users u
       LEFT JOIN files f ON u.id = f.user_id
       WHERE u.id = $1
       GROUP BY u.id, u.storage_limit`,
      [req.user.id]
    );
    
    const stats = result.rows[0] || { storage_limit: 5368709120, used_storage: 0, total_files: 0 };
    
    // Convert to numbers and calculate percentage
    const storageLimit = parseInt(stats.storage_limit) || 5368709120; // 5GB default
    const usedStorage = parseInt(stats.used_storage) || 0;
    const totalFiles = parseInt(stats.total_files) || 0;
    const usagePercentage = storageLimit > 0 ? (usedStorage / storageLimit) * 100 : 0;
    
    res.json({
      storage_limit: storageLimit,
      used_storage: usedStorage,
      available_storage: storageLimit - usedStorage,
      usage_percentage: Math.round(usagePercentage * 100) / 100,
      total_files: totalFiles
    });
    
  } catch (err) {
    console.error("Get storage stats error:", err);
    res.status(500).json({ message: "Failed to fetch storage stats", error: err.message });
  }
});

// Delete user account
router.delete("/account", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    
    // Verify password
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(400).json({ message: "Password is incorrect" });
    }
    
    // Delete user (CASCADE will handle related records)
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    
    res.json({ message: "Account deleted successfully" });
    
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ message: "Failed to delete account", error: err.message });
  }
});

module.exports = router;