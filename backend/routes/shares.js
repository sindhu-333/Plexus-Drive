const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../db');
const auth = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');
const { getSecureFrontendUrl } = require('../utils/urlHelper');
const NotificationService = require('../services/notificationService');
const { handleIPRedirect } = require('../middleware/ipRedirect');

const router = express.Router();

// Generate a unique share token
const generateShareToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate expiration date based on duration
const getExpirationDate = (duration) => {
  if (duration === 'never') return null;
  
  const now = new Date();
  const days = {
    '1d': 1,
    '7d': 7,
    '30d': 30
  };
  
  const daysToAdd = days[duration] || 7;
  return new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
};

// Create a new share
router.post('/files/:fileId/share', auth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const {
      shareType = 'public',
      accessLevel = 'view',
      expiresIn = '7d',
      passwordProtected = false,
      password = '',
      emails = '',
      message = ''
    } = req.body;

    // Verify user owns the file
    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found or access denied' });
    }

    const file = fileResult.rows[0];
    const shareToken = generateShareToken();
    const expiresAt = getExpirationDate(expiresIn);
    let passwordHash = null;

    // Hash password if provided
    if (passwordProtected && password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Handle email shares
    if (shareType === 'email') {
      const emailList = emails.split(',').map(email => email.trim()).filter(email => email);
      
      if (emailList.length === 0) {
        return res.status(400).json({ message: 'At least one email address is required for email shares' });
      }

      // Get user info for email
      const userResult = await pool.query(
        'SELECT name, email, profile_picture FROM users WHERE id = $1',
        [req.user.id]
      );
      const senderName = userResult.rows[0]?.name || 'Someone';
      const senderProfilePicture = userResult.rows[0]?.profile_picture || null;

      // Create shares for each email
      const shares = [];
      const emailInvitations = [];
      
      for (const email of emailList) {
        const emailToken = generateShareToken();
        const shareResult = await pool.query(
          `INSERT INTO file_shares (
            file_id, shared_by, share_type, share_token, shared_with_email,
            access_level, expires_at, password_protected, password_hash, message
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            fileId, req.user.id, shareType, emailToken, email,
            accessLevel, expiresAt, passwordProtected, passwordHash, message
          ]
        );

        const shareUrl = `${getSecureFrontendUrl(req)}/share/${emailToken}`;
        
        shares.push({
          ...shareResult.rows[0],
          shareUrl
        });

        // Prepare email invitation
        emailInvitations.push({
          recipientEmail: email,
          recipientName: email.split('@')[0], // Use email username as name
          senderName,
          senderProfilePicture,
          fileName: file.filename,
          shareUrl,
          accessLevel,
          message,
          expiresAt,
          req  // Pass request object for URL construction
        });
      }

      // Send email invitations
      console.log(`📧 Sending email invitations to: ${emailList.join(', ')}`);
      
      try {
        const emailResults = await emailService.sendBulkInvitations(emailInvitations);
        
        const successCount = emailResults.filter(r => r.success).length;
        const failedCount = emailResults.filter(r => !r.success).length;
        
        let responseMessage = `Email invitations sent successfully to ${successCount} recipient${successCount > 1 ? 's' : ''}`;
        
        if (failedCount > 0) {
          responseMessage += `. ${failedCount} email${failedCount > 1 ? 's' : ''} failed to send.`;
        }

        return res.json({
          message: responseMessage,
          shares: shares,
          emailResults,
          type: 'email',
          successCount,
          failedCount
        });
        
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        
        return res.json({
          message: 'Shares created but email sending failed. Share links are still valid.',
          shares: shares,
          type: 'email',
          emailError: true
        });
      }
    }

    // Create public share
    const shareResult = await pool.query(
      `INSERT INTO file_shares (
        file_id, shared_by, share_type, share_token,
        access_level, expires_at, password_protected, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        fileId, req.user.id, shareType, shareToken,
        accessLevel, expiresAt, passwordProtected, passwordHash
      ]
    );

    const share = shareResult.rows[0];
    const shareUrl = `${getSecureFrontendUrl(req)}/share/${shareToken}`;

    // Share notification removed - focus on important notifications only

    res.json({
      message: 'Share created successfully',
      share: {
        ...share,
        shareUrl
      },
      type: 'public'
    });

  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ message: 'Failed to create share' });
  }
});

// Get shares for a file
router.get('/files/:fileId/shares', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Verify user owns the file
    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found or access denied' });
    }

    // Get all active shares for the file
    const sharesResult = await pool.query(
      `SELECT fs.*, u.name as shared_by_name
       FROM file_shares fs
       JOIN users u ON fs.shared_by = u.id
       WHERE fs.file_id = $1 AND fs.is_active = true
       ORDER BY fs.created_at DESC`,
      [fileId]
    );

    const shares = sharesResult.rows.map(share => ({
      ...share,
      shareUrl: `${getSecureFrontendUrl(req)}/share/${share.share_token}`,
      isExpired: share.expires_at && new Date(share.expires_at) < new Date()
    }));

    res.json({ shares });

  } catch (error) {
    console.error('Get shares error:', error);
    res.status(500).json({ message: 'Failed to get shares' });
  }
});

// IP-independent share redirect (for old links with wrong IP)
router.get('/redirect/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Check if share exists
    const shareResult = await pool.query(
      `SELECT fs.share_token FROM file_shares fs WHERE fs.share_token = $1 AND fs.is_active = true`,
      [token]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ message: 'Share not found or has been revoked' });
    }

    // Redirect to current IP
    const currentUrl = `${getSecureFrontendUrl(req)}/share/${token}`;
    res.redirect(currentUrl);

  } catch (error) {
    console.error('Share redirect error:', error);
    res.status(500).json({ message: 'Failed to redirect share' });
  }
});

// Access a shared file (public endpoint with IP redirect)
router.get('/share/:token', handleIPRedirect, async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.query;

    // Get share details with file and user info
    const shareResult = await pool.query(
      `SELECT fs.*, f.filename, f.filesize, f.mimetype, f.dropbox_path,
              u.name as shared_by_name, u.email as shared_by_email
       FROM file_shares fs
       JOIN files f ON fs.file_id = f.id
       JOIN users u ON fs.shared_by = u.id
       WHERE fs.share_token = $1 AND fs.is_active = true`,
      [token]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ message: 'Share not found or has been revoked' });
    }

    const share = shareResult.rows[0];

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ message: 'Share has expired' });
    }

    // Check password if protected
    if (share.password_protected && share.password_hash) {
      if (!password) {
        return res.status(401).json({ 
          message: 'Password required',
          requiresPassword: true 
        });
      }

      const passwordValid = await bcrypt.compare(password, share.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }
    }

    // Log access
    await pool.query(
      `INSERT INTO share_access_logs (share_id, ip_address, user_agent, action)
       VALUES ($1, $2, $3, $4)`,
      [share.id, req.ip, req.get('User-Agent'), 'view']
    );

    // Update view count
    await pool.query(
      `UPDATE file_shares 
       SET view_count = view_count + 1, last_accessed_at = CURRENT_TIMESTAMP, last_accessed_ip = $2
       WHERE id = $1`,
      [share.id, req.ip]
    );

    // Return share info (without sensitive data)
    res.json({
      share: {
        id: share.id,
        file_id: share.file_id,
        access_level: share.access_level,
        expires_at: share.expires_at,
        created_at: share.created_at,
        view_count: share.view_count + 1
      },
      file: {
        filename: share.filename,
        filesize: share.filesize,
        mimetype: share.mimetype
      },
      sharedBy: {
        name: share.shared_by_name
      }
    });

  } catch (error) {
    console.error('Access share error:', error);
    res.status(500).json({ message: 'Failed to access share' });
  }
});

// Download shared file (with IP redirect)
router.get('/share/:token/download', handleIPRedirect, async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.query;

    // Get share details
    const shareResult = await pool.query(
      `SELECT fs.*, f.filename, f.filesize, f.mimetype, f.dropbox_path
       FROM file_shares fs
       JOIN files f ON fs.file_id = f.id
       WHERE fs.share_token = $1 AND fs.is_active = true`,
      [token]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ message: 'Share not found or has been revoked' });
    }

    const share = shareResult.rows[0];

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ message: 'Share has expired' });
    }

    // Check access level
    if (share.access_level === 'view') {
      return res.status(403).json({ message: 'Download not allowed for this share' });
    }

    // Check password if protected
    if (share.password_protected && share.password_hash) {
      if (!password) {
        return res.status(401).json({ 
          message: 'Password required',
          requiresPassword: true 
        });
      }

      const passwordValid = await bcrypt.compare(password, share.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }
    }

    // Log download
    await pool.query(
      `INSERT INTO share_access_logs (share_id, ip_address, user_agent, action)
       VALUES ($1, $2, $3, $4)`,
      [share.id, req.ip, req.get('User-Agent'), 'download']
    );

    // Update download count
    await pool.query(
      `UPDATE file_shares 
       SET download_count = download_count + 1, last_accessed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [share.id]
    );

    // Download file from Dropbox
    try {
      const { Dropbox } = require('dropbox');
      
      const dbx = new Dropbox({
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        fetch: global.fetch,
      });

      console.log(`📥 Downloading shared file from Dropbox: ${share.dropbox_path}`);
      
      const downloadRes = await dbx.filesDownload({ path: share.dropbox_path });
      
      if (!downloadRes || !downloadRes.result) {
        throw new Error('File download failed - no response from Dropbox');
      }

      // Handle different file binary formats from Dropbox
      let fileBuffer;
      const fileBinary = downloadRes.result.fileBinary;
      
      if (!fileBinary) {
        throw new Error('File download failed - no file data received');
      }
      
      // Convert various possible fileBinary formats to Buffer
      if (Buffer.isBuffer(fileBinary)) {
        fileBuffer = fileBinary;
      } else if (fileBinary instanceof ArrayBuffer) {
        fileBuffer = Buffer.from(new Uint8Array(fileBinary));
      } else if (ArrayBuffer.isView(fileBinary)) {
        fileBuffer = Buffer.from(fileBinary.buffer, fileBinary.byteOffset, fileBinary.byteLength);
      } else if (typeof fileBinary === 'string') {
        fileBuffer = Buffer.from(fileBinary, 'binary');
      } else {
        // Last resort: try to convert to Buffer
        fileBuffer = Buffer.from(fileBinary);
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('File buffer is empty or invalid');
      }
      
      console.log(`✅ File download successful:`, {
        filename: share.filename,
        mimetype: share.mimetype,
        bufferSize: fileBuffer.length,
        bufferType: Object.prototype.toString.call(fileBuffer)
      });
      
      // Set proper headers for file download
      res.setHeader('Content-Type', share.mimetype || 'application/octet-stream');
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${share.filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Send the file
      res.send(fileBuffer);

    } catch (downloadError) {
      console.error('❌ Dropbox download error:', {
        error: downloadError.message,
        status: downloadError.status,
        path: share.dropbox_path,
        filename: share.filename
      });
      
      // If Dropbox fails, return error but don't crash
      if (downloadError.status === 409) {
        return res.status(404).json({ 
          message: 'File no longer exists in storage',
          error: 'file_not_found',
          details: `File path: ${share.dropbox_path}`
        });
      }
      
      return res.status(500).json({ 
        message: 'Failed to download file from storage',
        error: downloadError.message,
        dropbox_path: share.dropbox_path 
      });
    }

  } catch (error) {
    console.error('Download share error:', error);
    res.status(500).json({ message: 'Failed to download shared file' });
  }
});

// Revoke/delete a share
router.delete('/:shareId', auth, async (req, res) => {
  try {
    const { shareId } = req.params;

    // Verify user owns the share
    const shareResult = await pool.query(
      'SELECT * FROM file_shares WHERE id = $1 AND shared_by = $2',
      [shareId, req.user.id]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ message: 'Share not found or access denied' });
    }

    // Deactivate the share (soft delete)
    await pool.query(
      'UPDATE file_shares SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [shareId]
    );

    res.json({ message: 'Share revoked successfully' });

  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({ message: 'Failed to revoke share' });
  }
});

// Update share settings
router.put('/:shareId', auth, async (req, res) => {
  try {
    const { shareId } = req.params;
    const { accessLevel, expiresIn, passwordProtected, password } = req.body;

    // Verify user owns the share
    const shareResult = await pool.query(
      'SELECT * FROM file_shares WHERE id = $1 AND shared_by = $2',
      [shareId, req.user.id]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ message: 'Share not found or access denied' });
    }

    let updateFields = [];
    let updateValues = [];
    let paramCounter = 1;

    if (accessLevel) {
      updateFields.push(`access_level = $${paramCounter++}`);
      updateValues.push(accessLevel);
    }

    if (expiresIn !== undefined) {
      updateFields.push(`expires_at = $${paramCounter++}`);
      updateValues.push(getExpirationDate(expiresIn));
    }

    if (passwordProtected !== undefined) {
      updateFields.push(`password_protected = $${paramCounter++}`);
      updateValues.push(passwordProtected);

      if (passwordProtected && password) {
        updateFields.push(`password_hash = $${paramCounter++}`);
        updateValues.push(await bcrypt.hash(password, 10));
      } else if (!passwordProtected) {
        updateFields.push(`password_hash = $${paramCounter++}`);
        updateValues.push(null);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = $${paramCounter++}`);
    updateValues.push(new Date());
    updateValues.push(shareId);

    const updateQuery = `
      UPDATE file_shares 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *
    `;

    const updatedShare = await pool.query(updateQuery, updateValues);

    res.json({
      message: 'Share updated successfully',
      share: updatedShare.rows[0]
    });

  } catch (error) {
    console.error('Update share error:', error);
    res.status(500).json({ message: 'Failed to update share' });
  }
});

// Get share analytics for a file
router.get('/files/:fileId/share-analytics', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Verify user owns the file
    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found or access denied' });
    }

    // Get analytics data
    const analyticsResult = await pool.query(
      `SELECT 
         fs.id,
         fs.share_type,
         fs.access_level,
         fs.view_count,
         fs.download_count,
         fs.created_at,
         fs.last_accessed_at,
         COUNT(sal.id) as total_accesses
       FROM file_shares fs
       LEFT JOIN share_access_logs sal ON fs.id = sal.share_id
       WHERE fs.file_id = $1 AND fs.is_active = true
       GROUP BY fs.id
       ORDER BY fs.created_at DESC`,
      [fileId]
    );

    // Get recent access logs
    const recentAccessResult = await pool.query(
      `SELECT sal.*, fs.share_type
       FROM share_access_logs sal
       JOIN file_shares fs ON sal.share_id = fs.id
       WHERE fs.file_id = $1
       ORDER BY sal.accessed_at DESC
       LIMIT 10`,
      [fileId]
    );

    res.json({
      shares: analyticsResult.rows,
      recentAccess: recentAccessResult.rows
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Failed to get share analytics' });
  }
});

// Get files shared with me
router.get('/shared-with-me', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    // Get files that have been shared with the current user's email
    const query = `
      SELECT 
        f.id, f.filename, f.filesize, f.mimetype, f.created_at, f.updated_at,
        fs.share_type, fs.access_level, fs.created_at as shared_at,
        fs.message, fs.expires_at,
        u.name as shared_by_username, u.email as shared_by_email,
        folders.name as folder_name
      FROM file_shares fs
      JOIN files f ON fs.file_id = f.id
      JOIN users u ON fs.shared_by = u.id
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE fs.shared_with_email = $1 
        AND fs.is_active = TRUE
        AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)
      ORDER BY fs.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [req.user.email, parseInt(limit), parseInt(offset)]);
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM file_shares fs
       WHERE fs.shared_with_email = $1 
         AND fs.is_active = TRUE
         AND (fs.expires_at IS NULL OR fs.expires_at > CURRENT_TIMESTAMP)`,
      [req.user.email]
    );
    
    res.json({
      files: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Get shared with me error:', error);
    res.status(500).json({ message: 'Failed to get shared files' });
  }
});

// Get files I have shared with others
router.get('/my-shares', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    // Get files that the current user has shared with others
    const query = `
      SELECT 
        f.id, f.filename, f.filesize, f.mimetype, f.created_at, f.updated_at,
        fs.share_type, fs.access_level, fs.created_at as shared_at,
        fs.message, fs.expires_at, fs.shared_with_email,
        fs.view_count, fs.download_count, fs.last_accessed_at as share_last_accessed,
        folders.name as folder_name
      FROM file_shares fs
      JOIN files f ON fs.file_id = f.id
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE fs.shared_by = $1 
        AND fs.is_active = TRUE
      ORDER BY fs.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [req.user.id, parseInt(limit), parseInt(offset)]);
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM file_shares fs
       WHERE fs.shared_by = $1 
         AND fs.is_active = TRUE`,
      [req.user.id]
    );
    
    res.json({
      files: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Get my shares error:', error);
    res.status(500).json({ message: 'Failed to get my shared files' });
  }
});

module.exports = router;