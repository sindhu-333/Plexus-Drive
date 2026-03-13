const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { getCurrentNetworkIP, getSecureBackendUrl } = require('../utils/urlHelper');

class EmailService {
  constructor() {
    // For development, we'll use a test account
    // In production, you would use a real SMTP service like Gmail, SendGrid, etc.
    this.transporter = null;
    this.initialized = false;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  async initializeTransporter() {
    try {
      const brevoApiKey = process.env.BREVO_API_KEY;

      // Prefer Brevo HTTP API in production (works on Render — no SMTP port blocking)
      if (brevoApiKey) {
        console.log('📧 Email service initializing with Brevo API');
        const fromEmail = process.env.EMAIL_FROM;
        if (!fromEmail) {
          throw new Error('Missing EMAIL_FROM in environment variables');
        }

        this.transporter = {
          sendMail: async (mailOptions) => {
            const toList = Array.isArray(mailOptions.to)
              ? mailOptions.to.map(e => ({ email: e }))
              : [{ email: mailOptions.to }];

            const payload = {
              sender: { name: 'Plexus Drive', email: fromEmail },
              to: toList,
              subject: mailOptions.subject,
              htmlContent: mailOptions.html,
              textContent: mailOptions.text,
            };

            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': brevoApiKey,
              },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Brevo API error ${response.status}: ${errText}`);
            }

            const data = await response.json();
            console.log('✅ Brevo email sent:', data.messageId);
            return {
              messageId: data.messageId || `brevo-${Date.now()}`,
              accepted: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
              rejected: [],
            };
          },
        };

        console.log('✅ Email service initialized with Brevo API');
        console.log('✅ Emails will be sent from:', fromEmail);
        this.initialized = true;
        return;
      }

      const emailHost = process.env.EMAIL_HOST;
      const emailUser = process.env.EMAIL_USER;
      const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

      // Fall back to SMTP (local dev)
      if (emailUser && emailPass && emailHost) {
        console.log('📧 Email service initializing with SMTP:', emailHost);

        this.transporter = nodemailer.createTransport({
          host: emailHost,
          port: parseInt(process.env.EMAIL_PORT) || 587,
          secure: process.env.EMAIL_SECURE === 'true',
          auth: { user: emailUser, pass: emailPass },
          tls: { rejectUnauthorized: false },
        });

        await this.transporter.verify();
        console.log('✅ SMTP connection verified - Real emails will be sent');
      } else {
        if (this.isProduction) {
          throw new Error('Missing BREVO_API_KEY (or EMAIL_HOST/EMAIL_USER/EMAIL_PASS) in production environment');
        }

        // Demo mode for local dev without credentials
        this.transporter = {
          sendMail: async (mailOptions) => {
            console.log('📧 DEMO EMAIL SENT:');
            console.log('   To:', mailOptions.to);
            console.log('   Subject:', mailOptions.subject);
            console.log('   Content:', mailOptions.text?.substring(0, 100) + '...');
            return {
              messageId: `demo-${Date.now()}@plexusdrive.com`,
              accepted: [mailOptions.to],
              rejected: [],
            };
          },
        };
        console.log('📧 Email service initialized in DEMO mode');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.initialized = false;
      this.transporter = null;

      if (this.isProduction) {
        throw error;
      }

      // Fallback demo mode on local error
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 FALLBACK DEMO EMAIL:');
          console.log('   To:', mailOptions.to);
          console.log('   Subject:', mailOptions.subject);
          return {
            messageId: `fallback-${Date.now()}@plexusdrive.com`,
            accepted: [mailOptions.to],
            rejected: [],
          };
        },
      };
      this.initialized = true;
    }
  }

  async sendShareInvitation(options) {
    const {
      recipientEmail,
      recipientName,
      senderName,
      senderProfilePicture,
      fileName,
      shareUrl,
      accessLevel,
      message,
      expiresAt,
      req
    } = options;

    try {
      // Ensure transporter is initialized
      if (!this.transporter) {
        await this.initializeTransporter();
      }
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const accessLevelText = {
        view: 'view the file',
        download: 'view and download the file',
        full: 'view, download, and manage the file'
      };

      const expirationText = expiresAt 
        ? `This share will expire on ${new Date(expiresAt).toLocaleDateString()}.`
        : 'This share does not expire.';

      // Always use Plexus Drive logo
      const logoHtml = `<img src="cid:plexuslogo" alt="Plexus Drive" class="brand-logo">`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>File Shared with You</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { color: #3b82f6; font-size: 24px; font-weight: bold; margin-bottom: 8px; }
            .brand-logo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 16px auto; display: block; }
            .sender-info { text-align: center; margin-bottom: 24px; }
            .sender-name { font-size: 18px; font-weight: 600; color: #111827; margin: 8px 0 4px 0; }
            .title { font-size: 24px; font-weight: 600; color: #111827; margin: 0 0 8px 0; }
            .subtitle { color: #6b7280; margin: 0; }
            .file-info { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #3b82f6; }
            .file-name { font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px 0; }
            .file-details { color: #6b7280; font-size: 14px; }
            .access-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
            .message-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0; }
            .message-title { font-weight: 600; color: #92400e; margin: 0 0 8px 0; }
            .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
            .warning { color: #dc2626; font-size: 12px; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                ${logoHtml}
                <div class="logo">Plexus Drive</div>
                <h1 class="title">File Shared With You</h1>
              </div>
              
              <div class="sender-info">
                <div class="sender-name">${senderName}</div>
                <p class="subtitle">has shared a file with you</p>
              </div>
              
              <div class="file-info">
                <div class="file-name">📄 ${fileName}</div>
                <div class="file-details">
                  Access Level: You can ${accessLevelText[accessLevel] || 'view the file'}<br>
                  ${expirationText}
                </div>
              </div>

              ${message ? `
                <div class="message-box">
                  <div class="message-title">💬 Personal Message:</div>
                  <div>${message}</div>
                </div>
              ` : ''}

              <div style="text-align: center; margin: 32px 0;">
                <a href="${shareUrl}" class="access-button">🔗 Access File</a>
              </div>

              <div class="footer">
                <p>This file was shared securely through Plexus Drive.</p>
                <p>If you don't recognize this sender, please ignore this email.</p>
                <p class="warning">⚠️ Do not share this link with others unless authorized.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailText = `
${senderName} has shared a file with you via Plexus Drive

File: ${fileName}
Access Level: You can ${accessLevelText[accessLevel] || 'view the file'}
${expirationText}

${message ? `Personal Message: ${message}` : ''}

Access the file here: ${shareUrl}

This file was shared securely through Plexus Drive.
If you don't recognize this sender, please ignore this email.
Do not share this link with others unless authorized.
      `;

      // Check if logo file exists
      const logoPath = path.join(__dirname, '../public/assets/prof.jpeg');
      let attachments = [];
      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: 'prof.jpeg',
          path: logoPath,
          cid: 'plexuslogo'
        });
      }

      const mailOptions = {
        from: `"Plexus Drive" <${process.env.EMAIL_FROM || 'noreply@plexusdrive.com'}>`,
        to: recipientEmail,
        replyTo: process.env.EMAIL_FROM,
        subject: `Plexus Drive - ${senderName} shared "${fileName}" with you`,
        text: emailText,
        html: emailHtml,
        attachments: attachments,
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'Plexus Drive',
          'List-Unsubscribe': `<mailto:${process.env.EMAIL_FROM}?subject=unsubscribe>`
        }
      };

      console.log('📤 Attempting to send share invitation to:', recipientEmail);
      
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Share invitation email sent successfully!');
      console.log('   → To:', recipientEmail);
      console.log('   → Message ID:', result.messageId);
      console.log('   → Response:', result.response);
      console.log('   → Accepted:', result.accepted);
      console.log('   → Rejected:', result.rejected);
      
      // For development, log the preview URL
      if (process.env.NODE_ENV === 'development') {
        console.log('📮 Preview URL:', nodemailer.getTestMessageUrl(result));
      }

      return {
        success: true,
        messageId: result.messageId,
        previewUrl: process.env.NODE_ENV === 'development' ? nodemailer.getTestMessageUrl(result) : null
      };

    } catch (error) {
      console.error('❌ Failed to send email to', recipientEmail);
      console.error('   → Error:', error.message);
      console.error('   → Code:', error.code);
      console.error('   → Response:', error.response);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendEmail(emailData) {
    try {
      // Ensure transporter is initialized
      if (!this.initialized || !this.transporter) {
        await this.initializeTransporter();
      }

      const mailOptions = {
        from: emailData.from || `"Plexus Drive" <${process.env.EMAIL_FROM || 'noreply@plexusdrive.com'}>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      };

      console.log('📤 Attempting to send email to:', emailData.to);
      console.log('📤 Subject:', mailOptions.subject);
      
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully!');
      console.log('   → To:', emailData.to);
      console.log('   → Message ID:', result.messageId);
      console.log('   → Response:', result.response);
      console.log('   → Accepted:', result.accepted);
      console.log('   → Rejected:', result.rejected);
      
      return {
        success: true,
        messageId: result.messageId,
        previewUrl: process.env.NODE_ENV === 'development' ? nodemailer.getTestMessageUrl(result) : null
      };

    } catch (error) {
      console.error('❌ Failed to send email to', emailData.to);
      console.error('   → Error:', error.message);
      console.error('   → Code:', error.code);
      console.error('   → Response:', error.response);
      throw error; // Re-throw to match the expected behavior in auth routes
    }
  }

  async sendBulkInvitations(invitations) {
    const results = [];
    
    for (const invitation of invitations) {
      const result = await this.sendShareInvitation(invitation);
      results.push({
        email: invitation.recipientEmail,
        ...result
      });
    }

    return results;

  }

  /**
   * Send email verification link
   */
  async sendEmailVerification(userEmail, userName, verificationUrl, userProfilePicture = null, req = null) {
    if (!this.initialized) {
      await this.initializeTransporter();
    }

    // Get current network IP dynamically
    const currentNetworkIP = getCurrentNetworkIP();
    
    // Always use Plexus Drive logo
    const logoHtml = `<img src="cid:plexuslogo" alt="Plexus Drive" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 16px auto; display: block;">`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Plexus Drive</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .security-note { background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoHtml}
            <h1>🔐 Verify Your Email</h1>
            <p>Welcome to Plexus Drive!</p>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Thank you for signing up for Plexus Drive. To complete your registration and start using your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <div class="security-note">
              <strong>⚠️ Security Note:</strong>
              <ul>
                <li>This verification link will expire in 24 hours</li>
                <li>You cannot log in until your email is verified</li>
                <li>If you didn't create this account, you can safely ignore this email</li>
              </ul>
            </div>
            
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace;">
              ${verificationUrl}
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <strong>🌐 Cross-Network Access Options:</strong><br>
              If the link above doesn't work (different network), try these alternatives:
              <ol>
                <li><strong>Direct Network Access:</strong><br>
                    <a href="http://${currentNetworkIP}:3000/verify-email?token=${verificationUrl.split('token=')[1] || 'TOKEN_NOT_FOUND'}" style="color: #0066cc;">http://${currentNetworkIP}:3000/verify-email?token=${verificationUrl.split('token=')[1] || 'TOKEN_NOT_FOUND'}</a>
                </li>
                <li><strong>Manual Verification:</strong><br>
                    Go to any of these URLs and use manual verification:
                    <ul style="margin: 8px 0; padding-left: 20px;">
                      <li><code>http://localhost:3000/verify-email</code> (same network)</li>
                      <li><code>http://${currentNetworkIP}:3000/verify-email</code> (network access)</li>
                    </ul>
                    Then paste this verification token:<br>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; margin: 8px 0; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">
                      ${verificationUrl.split('token=')[1] || 'TOKEN_NOT_FOUND'}
                    </div>
                </li>
              </ol>
            </div>
            
            <p>Welcome to secure file sharing with Plexus Drive!</p>
            
            <p>Best regards,<br>The Plexus Drive Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Plexus Drive. Please do not reply to this email.</p>
            <p>If you have questions, contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Hello ${userName}!
      
      Thank you for signing up for Plexus Drive. To complete your registration and start using your account, please verify your email address by visiting this link:
      
      ${verificationUrl}
      
      CROSS-NETWORK ACCESS OPTIONS:
      If the main link doesn't work (different network), try these alternatives:
      
      Option 1 - Direct Network Access:
      http://${currentNetworkIP}:3000/verify-email?token=${verificationUrl.split('token=')[1] || 'TOKEN_NOT_FOUND'}
      
      Option 2 - Manual Verification:
      1. Go to: http://localhost:3000/verify-email OR http://${currentNetworkIP}:3000/verify-email
      2. Click "Manual Verification (Cross-Network)"  
      3. Copy and paste this token: ${verificationUrl.split('token=')[1] || 'TOKEN_NOT_FOUND'}
      
      Security Note:
      - This verification link will expire in 24 hours
      - You cannot log in until your email is verified
      - If you didn't create this account, you can safely ignore this email
      
      Welcome to secure file sharing with Plexus Drive!
      
      Best regards,
      The Plexus Drive Team
    `;

    // Check if logo file exists
    const logoPath = path.join(__dirname, '../public/assets/prof.jpeg');
    let attachments = [];
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: 'prof.jpeg',
        path: logoPath,
        cid: 'plexuslogo'
      });
    }

    const mailOptions = {
      from: `"Plexus Drive" <${process.env.EMAIL_FROM || 'noreply@plexusdrive.com'}>`,
      to: userEmail,
      replyTo: process.env.EMAIL_FROM,
      subject: 'Plexus Drive - Verify Your Email',
      text: text,
      html: html,
      attachments: attachments,
      headers: {
        'X-Priority': '1',
        'Importance': 'high',
        'X-Mailer': 'Plexus Drive',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_FROM}?subject=unsubscribe>`
      }
    };

    try {
      console.log('📤 Attempting to send verification email to:', userEmail);
      console.log('📤 From address:', mailOptions.from);
      console.log('📤 Subject:', mailOptions.subject);
      
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email verification sent successfully!');
      console.log('   → To:', userEmail);
      console.log('   → Message ID:', result.messageId);
      console.log('   → Response:', result.response);
      console.log('   → Accepted:', result.accepted);
      console.log('   → Rejected:', result.rejected);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to send email verification to', userEmail, ':', error);
      throw error;
    }
  }

  /**
   * Send security alert email for failed login attempts
   */
  async sendFailedLoginAlert(userEmail, userName, ipAddress, timestamp, location = 'Unknown location') {
    if (!this.initialized) {
      await this.initializeTransporter();
    }

    // Always use Plexus Drive logo
    const logoHtml = `<img src="cid:plexuslogo" alt="Plexus Drive" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px;">`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Security Alert - Failed Login Attempt</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
              .alert-box { background: #fee2e2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 0.9em; color: #6b7280; border-radius: 0 0 8px 8px; }
              .button { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 15px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  ${logoHtml}
                  <h1>🔒 Security Alert</h1>
                  <p>Failed login attempt detected</p>
              </div>
              
              <div class="content">
                  <div class="alert-box">
                      <h3>⚠️ Unauthorized Access Attempt</h3>
                      <p>Someone tried to access your Plexus Drive account with an incorrect password.</p>
                  </div>
                  
                  <div class="details">
                      <h4>Attempt Details:</h4>
                      <ul>
                          <li><strong>Time:</strong> ${timestamp}</li>
                          <li><strong>IP Address:</strong> ${ipAddress}</li>
                          <li><strong>Location:</strong> ${location}</li>
                          <li><strong>Account:</strong> ${userEmail}</li>
                      </ul>
                  </div>
                  
                  <h4>What should you do?</h4>
                  <ul>
                      <li><strong>If this was you:</strong> No action needed. Make sure you're using the correct password.</li>
                      <li><strong>If this wasn't you:</strong> Consider changing your password immediately and enable two-factor authentication if available.</li>
                  </ul>
                  
                  <p>If you have concerns about your account security, please contact our support team immediately.</p>
              </div>
              
              <div class="footer">
                  <p>This is an automated security notification from Plexus Drive.<br>
                  If you didn't expect this email, please contact support.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
Security Alert - Failed Login Attempt

Someone tried to access your Plexus Drive account with an incorrect password.

Attempt Details:
- Time: ${timestamp}
- IP Address: ${ipAddress}  
- Location: ${location}
- Account: ${userEmail}

What should you do?
- If this was you: No action needed. Make sure you're using the correct password.
- If this wasn't you: Consider changing your password immediately and enable two-factor authentication if available.

If you have concerns about your account security, please contact our support team immediately.

This is an automated security notification from Plexus Drive.
    `;

    try {
      // Check if logo file exists
      const logoPath = path.join(__dirname, '../public/assets/prof.jpeg');
      let attachments = [];
      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: 'prof.jpeg',
          path: logoPath,
          cid: 'plexuslogo'
        });
      }

      const mailOptions = {
        from: `"Plexus Drive" <${process.env.EMAIL_FROM || 'security@plexusdrive.com'}>`,
        to: userEmail,
        subject: '  Plexus Drive - Security Alert: Failed login attempt',
        html,
        text,
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Security alert email sent to:', userEmail);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('❌ Failed to send security alert email to', userEmail, ':', error);
      throw error;
    }
  }

  /**
   * Send email notification for password changes
   */
  async sendPasswordChangeConfirmation(userEmail, userName, timestamp, ipAddress, location = 'Unknown location') {
    if (!this.initialized) {
      await this.initializeTransporter();
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed Successfully</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
              .success-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 0.9em; color: #6b7280; border-radius: 0 0 8px 8px; }
              .alert { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin: 15px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔐 Password Changed</h1>
                  <p>Your account password has been updated</p>
              </div>
              
              <div class="content">
                  <div class="success-box">
                      <h3>✅ Password Successfully Changed</h3>
                      <p>Your Plexus Drive account password has been changed successfully.</p>
                  </div>
                  
                  <div class="details">
                      <h4>Change Details:</h4>
                      <ul>
                          <li><strong>Time:</strong> ${timestamp}</li>
                          <li><strong>IP Address:</strong> ${ipAddress}</li>
                          <li><strong>Location:</strong> ${location}</li>
                          <li><strong>Account:</strong> ${userEmail}</li>
                      </ul>
                  </div>
                  
                  <div class="alert">
                      <h4>⚠️ Didn't make this change?</h4>
                      <p>If you did not change your password, your account may have been compromised. Please:</p>
                      <ul>
                          <li>Contact our support team immediately</li>
                          <li>Try to regain access to your account</li>
                          <li>Check your account for any unauthorized activity</li>
                      </ul>
                  </div>
              </div>
              
              <div class="footer">
                  <p>This is an automated security notification from Plexus Drive.<br>
                  If you didn't expect this email, please contact support immediately.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
Password Changed Successfully

Your Plexus Drive account password has been changed successfully.

Change Details:
- Time: ${timestamp}
- IP Address: ${ipAddress}
- Location: ${location}
- Account: ${userEmail}

Didn't make this change?
If you did not change your password, your account may have been compromised. Please:
- Contact our support team immediately
- Try to regain access to your account  
- Check your account for any unauthorized activity

This is an automated security notification from Plexus Drive.
    `;

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'security@plexusdrive.com',
        to: userEmail,
        subject: '🔐 Password Changed - Plexus Drive Account',
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password change confirmation email sent to:', userEmail);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('❌ Failed to send password change email to', userEmail, ':', error);
      throw error;
    }
  }

  /**
   * Send email notification for email address changes
   */
  async sendEmailChangeConfirmation(oldEmail, newEmail, userName, timestamp, ipAddress, location = 'Unknown location') {
    if (!this.initialized) {
      await this.initializeTransporter();
    }

    // Send to OLD email address as security measure
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Address Changed</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
              .info-box { background: #eff6ff; border: 1px solid #93c5fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 0.9em; color: #6b7280; border-radius: 0 0 8px 8px; }
              .alert { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin: 15px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>📧 Email Address Changed</h1>
                  <p>Your account email has been updated</p>
              </div>
              
              <div class="content">
                  <div class="info-box">
                      <h3>📬 Email Address Updated</h3>
                      <p>The email address for your Plexus Drive account has been changed.</p>
                      <p><strong>From:</strong> ${oldEmail}</p>
                      <p><strong>To:</strong> ${newEmail}</p>
                  </div>
                  
                  <div class="details">
                      <h4>Change Details:</h4>
                      <ul>
                          <li><strong>Time:</strong> ${timestamp}</li>
                          <li><strong>IP Address:</strong> ${ipAddress}</li>
                          <li><strong>Location:</strong> ${location}</li>
                      </ul>
                  </div>
                  
                  <div class="alert">
                      <h4>⚠️ Didn't make this change?</h4>
                      <p>If you did not change your email address, your account may have been compromised. Please:</p>
                      <ul>
                          <li>Contact our support team immediately at support@plexusdrive.com</li>
                          <li>Try to regain access to your account</li>
                          <li>Check your account for any unauthorized activity</li>
                      </ul>
                      <p><strong>Important:</strong> Future notifications will be sent to the new email address (${newEmail}).</p>
                  </div>
              </div>
              
              <div class="footer">
                  <p>This notification was sent to your previous email address as a security measure.<br>
                  This is an automated security notification from Plexus Drive.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
Email Address Changed

The email address for your Plexus Drive account has been changed.

From: ${oldEmail}
To: ${newEmail}

Change Details:
- Time: ${timestamp}
- IP Address: ${ipAddress}
- Location: ${location}

Didn't make this change?
If you did not change your email address, your account may have been compromised. Please:
- Contact our support team immediately at support@plexusdrive.com
- Try to regain access to your account
- Check your account for any unauthorized activity

Important: Future notifications will be sent to the new email address (${newEmail}).

This notification was sent to your previous email address as a security measure.
This is an automated security notification from Plexus Drive.
    `;

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'security@plexusdrive.com',
        to: oldEmail, // Send to OLD email as security measure
        subject: '📧 Email Address Changed - Plexus Drive Account',
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email change notification sent to OLD address:', oldEmail);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('❌ Failed to send email change notification to', oldEmail, ':', error);
      throw error;
    }
  }
}

module.exports = new EmailService();