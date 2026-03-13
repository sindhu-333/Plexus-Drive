const express = require('express');
const { pool } = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateToken } = require('../auth');
const authMiddleware = require('../middleware/authMiddleware');
const { registerValidation, loginValidation, validate } = require('../middleware/validation');
const emailService = require('../services/emailService');
const { getSecureFrontendUrl } = require('../utils/urlHelper');
const NotificationService = require('../services/notificationService');
const { handleIPRedirect } = require('../middleware/ipRedirect');

const router = express.Router();

// Health check endpoint for IP detection
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint to check URL generation
router.get('/test-url-generation', (req, res) => {
    const testUrl = getSecureFrontendUrl(req);
    const verificationUrl = `${testUrl}/verify-email?token=test-token`;
    
    res.json({
        frontendUrl: testUrl,
        sampleVerificationUrl: verificationUrl,
        requestInfo: {
            origin: req.headers.origin,
            host: req.headers.host,
            referer: req.headers.referer,
            userAgent: req.headers['user-agent']
        }
    });
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, name, profile_picture, theme, language, timezone FROM users WHERE id=$1', [req.user.id]);
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Register
router.post('/register', registerValidation, validate, async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Enhanced password validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: 'Password does not meet requirements',
                errors: [{ 
                    field: 'password', 
                    message: 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character' 
                }]
            });
        }

        // Check if email already exists
        const existingUser = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            if (existingUser.rows[0].email_verified) {
                return res.status(400).json({ 
                    message: 'Validation failed',
                    errors: [{ field: 'email', message: 'Email is already registered and verified' }]
                });
            } else {
                // User exists but not verified - allow re-registration with new verification token
                await pool.query('DELETE FROM users WHERE email = $1 AND email_verified = FALSE', [email]);
            }
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO users (email, password, name, email_verified, verification_token, verification_token_expires, account_status) 
             VALUES ($1, $2, $3, FALSE, $4, $5, 'pending') 
             RETURNING id, email, name`,
            [email, hashedPassword, name, verificationToken, verificationExpires]
        );
        
        const user = result.rows[0];
        
        // Send verification email
        try {
            const verificationUrl = `${getSecureFrontendUrl(req)}/verify-email?token=${verificationToken}`;
            // User just registered, so no profile picture yet
            await emailService.sendEmailVerification(email, name, verificationUrl, null, req);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Don't fail registration if email fails, but log it
        }
        
        res.status(201).json({ 
            message: 'Registration successful. Please check your email to verify your account.',
            email: user.email,
            requiresVerification: true
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Failed to create account. Please try again.' });
    }
});

// Login
router.post('/login', loginValidation, validate, async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ 
                message: 'Authentication failed',
                errors: [{ field: 'email', message: 'Email or password is incorrect' }]
            });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            // Send security alert email for failed login attempt
            try {
                const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
                const timestamp = new Date().toLocaleString();
                await emailService.sendFailedLoginAlert(
                    user.email,
                    user.name,
                    ipAddress,
                    timestamp,
                    'Unknown location' // Could integrate with IP geolocation service
                );
                
                // Also create in-app notification for logged in users
                await NotificationService.notifyFailedLogin(user.id, ipAddress, 'Login attempt with incorrect password');
            } catch (securityError) {
                console.error('Failed to send security notifications:', securityError);
            }

            return res.status(401).json({ 
                message: 'Authentication failed',
                errors: [{ field: 'password', message: 'Email or password is incorrect' }]
            });
        }

        // Check if email is verified
        if (!user.email_verified) {
            return res.status(401).json({
                message: 'Email not verified',
                errors: [{ 
                    field: 'email', 
                    message: 'Please verify your email address before logging in. Check your inbox for a verification link.' 
                }],
                requiresVerification: true
            });
        }

        const token = generateToken(user);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        res.json({ 
            user: { id: user.id, email: user.email, name: user.name, profile_picture: user.profile_picture }, 
            token 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed. Please try again.' });
    }
});

// Email Verification (with IP redirect for old emails)
router.get('/verify-email', handleIPRedirect, async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }
        
        // Find user with this verification token
        const result = await pool.query(
            'SELECT id, email, name, verification_token_expires FROM users WHERE verification_token = $1',
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid verification token' });
        }
        
        const user = result.rows[0];
        
        // Check if token has expired
        if (new Date() > new Date(user.verification_token_expires)) {
            return res.status(400).json({ message: 'Verification token has expired. Please register again.' });
        }
        
        // Update user as verified
        await pool.query(
            `UPDATE users 
             SET email_verified = TRUE, 
                 account_status = 'active',
                 verification_token = NULL,
                 verification_token_expires = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [user.id]
        );
        
        // Send welcome notification
        try {
            await NotificationService.createNotification(
                user.id,
                'Welcome to Plexus Drive!',
                'Your account has been successfully verified. You can now start uploading and sharing files.',
                'success',
                'account_verified'
            );
        } catch (notificationError) {
            console.error('Failed to create welcome notification:', notificationError);
        }
        
        res.json({ 
            message: 'Email verified successfully! You can now log in to your account.',
            verified: true 
        });
        
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'Email verification failed. Please try again.' });
    }
});

// Resend Verification Email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        
        // Find unverified user
        const result = await pool.query(
            'SELECT id, name, email_verified FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No account found with this email' });
        }
        
        const user = result.rows[0];
        
        if (user.email_verified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }
        
        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await pool.query(
            'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
            [verificationToken, verificationExpires, user.id]
        );
        
        // Send verification email
        try {
            const verificationUrl = `${getSecureFrontendUrl(req)}/verify-email?token=${verificationToken}`;
            // Fetch user's profile picture if they have one
            const profilePicture = user.profile_picture || null;
            await emailService.sendEmailVerification(email, user.name, verificationUrl, profilePicture, req);
        } catch (emailError) {
            console.error('Failed to resend verification email:', emailError);
            return res.status(500).json({ message: 'Failed to send verification email' });
        }
        
        res.json({ message: 'Verification email sent successfully' });
        
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ message: 'Failed to resend verification email' });
    }
});

// Password Reset Request
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if user exists
        const userResult = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email]);
        
        // Always return success to prevent email enumeration attacks
        if (userResult.rows.length === 0) {
            return res.json({ 
                message: 'If an account with that email exists, a password reset link has been sent.' 
            });
        }

        const user = userResult.rows[0];
        
        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

        // Store reset token in database
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [resetToken, resetTokenExpires, user.id]
        );

        // Send password reset email
        const resetUrl = `${getSecureFrontendUrl(req)}/reset-password/${resetToken}`;
        
        const emailData = {
            to: user.email,
            subject: 'Password Reset - Plexus Drive',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3b82f6;">Password Reset Request</h2>
                    <p>Hi ${user.name},</p>
                    <p>We received a request to reset your password for your Plexus Drive account.</p>
                    <p>Click the link below to reset your password:</p>
                    <a href="${resetUrl}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; 
                              color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                        Reset Password
                    </a>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Plexus Drive - Secure File Sharing<br>
                        If you're having trouble clicking the button, copy and paste this URL into your browser:<br>
                        ${resetUrl}
                    </p>
                </div>
            `
        };

        await emailService.sendEmail(emailData);

        res.json({ 
            message: 'If an account with that email exists, a password reset link has been sent.' 
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ message: 'Failed to process password reset request' });
    }
});

// Password Reset Confirmation
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Find user with valid reset token
        const userResult = await pool.query(
            'SELECT id, email, name FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        const user = userResult.rows[0];

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update password and clear reset token
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        // Send confirmation email
        const emailData = {
            to: user.email,
            subject: 'Password Successfully Reset - Plexus Drive',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #10b981;">Password Reset Successful</h2>
                    <p>Hi ${user.name},</p>
                    <p>Your password has been successfully reset for your Plexus Drive account.</p>
                    <p>If you didn't make this change, please contact support immediately.</p>
                    <p>You can now log in with your new password.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Plexus Drive - Secure File Sharing
                    </p>
                </div>
            `
        };

        try {
            await emailService.sendEmail(emailData);
        } catch (emailError) {
            console.warn('Failed to send password reset confirmation email:', emailError);
            // Don't fail the request if email fails
        }

        res.json({ message: 'Password reset successful. You can now log in with your new password.' });

    } catch (error) {
        console.error('Password reset confirmation error:', error);
        res.status(500).json({ message: 'Failed to reset password' });
    }
});

// Validate Reset Token (for frontend to check if token is valid before showing form)
router.get('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const userResult = await pool.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        res.json({ message: 'Valid reset token' });

    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({ message: 'Failed to validate reset token' });
    }
});

// Email verification endpoint
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('Email verification attempt for token:', token);
    
    // Find user with this verification token
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email_verification_token = ? AND email_verified = 0',
        [token],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      console.log('Invalid or expired verification token:', token);
      // Redirect to frontend with error
      return res.redirect(`${process.env.EMAIL_FRONTEND_URL || `http://${require('../utils/urlHelper').getCurrentNetworkIP()}:5173`}/auth?verified=false&message=Invalid or expired verification token`);
    }

    // Update user as verified
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET email_verified = 1, email_verification_token = NULL WHERE id = ?',
        [user.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log('Email verified successfully for user:', user.email);
    // Redirect to frontend with success
    res.redirect(`${process.env.EMAIL_FRONTEND_URL || `http://${require('../utils/urlHelper').getCurrentNetworkIP()}:5173`}/auth?verified=true&message=Email verified successfully! You can now log in.`);

  } catch (error) {
    console.error('Email verification error:', error);
    // Redirect to frontend with error
    res.redirect(`${process.env.EMAIL_FRONTEND_URL || `http://${require('../utils/urlHelper').getCurrentNetworkIP()}:5173`}/auth?verified=false&message=Failed to verify email`);
  }
});

module.exports = router;
