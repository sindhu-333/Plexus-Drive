# 🚀 Plexus Drive Deployment Guide

## FREE Deployment Stack

- **Frontend**: Netlify (FREE)
- **Backend**: Render (FREE with sleep mode)
- **Database**: Neon or Supabase (FREE)
- **File Storage**: Dropbox API (FREE - 2GB)
- **Email**: Gmail SMTP (FREE)

**Total Cost: $0/month** ✅

---

## Prerequisites

1. ✅ GitHub account
2. ✅ Netlify account (https://netlify.com - sign up with GitHub)
3. ✅ Render account (https://render.com - sign up with GitHub)
4. ✅ Neon account (https://neon.tech - sign up with GitHub)
5. ✅ Gmail account with App Password
6. ✅ Dropbox account with API token

---

## Part 1: Push Code to GitHub

### 1. Create GitHub Repository

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for deployment"

# Create repository on GitHub.com, then:
git remote add origin https://github.com/YOUR-USERNAME/plexus-drive.git
git branch -M main
git push -u origin main
```

---

## Part 2: Deploy Database (Neon)

### 1. Create Database

1. Go to https://neon.tech
2. Click "Sign Up" with GitHub
3. Create new project: "plexus-drive"
4. Copy the **Connection String** (looks like):
   ```
   postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/plexus_db
   ```

### 2. Import Database Schema

1. In Neon dashboard, click "SQL Editor"
2. Copy content from `database.sql`
3. Paste and run in SQL Editor
4. No additional migration scripts are required

### 3. Verify Tables

Run this in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see: users, files, file_ai_results, shares, notifications, etc.

---

## Part 3: Deploy Backend (Render)

### 1. Create Web Service

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select "plexus-drive" repo

### 2. Configure Service

**Settings:**
- **Name**: plexus-drive-backend
- **Region**: Choose closest to you
- **Branch**: main
- **Root Directory**: backend
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free

### 3. Add Environment Variables

Click "Environment" and add:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=<your-neon-connection-string>
JWT_SECRET=<generate-random-string>
FRONTEND_URL=https://your-frontend.netlify.app
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_FROM=your-email@gmail.com
DROPBOX_APP_KEY=your-dropbox-app-key
DROPBOX_APP_SECRET=your-dropbox-app-secret
DROPBOX_REFRESH_TOKEN=your-dropbox-refresh-token
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Deploy

1. Click "Create Web Service"
2. Wait 3-5 minutes for build
3. Copy your backend URL: `https://plexus-drive-backend.onrender.com`
4. Test health: `https://plexus-drive-backend.onrender.com/health`

---

## Part 4: Deploy Worker (Optional - For AI Analysis)

### 1. Create Background Worker

1. In Render dashboard, click "New +" → "Background Worker"
2. Select same repository
3. **Root Directory**: backend
4. **Build Command**: `npm install`
5. **Start Command**: `node worker.js`
6. Add same environment variables (DATABASE_URL, DROPBOX, etc.)

### 2. Deploy Worker

Worker will process AI analysis jobs in background.

---

## Part 5: Deploy Frontend (Netlify)

### 1. Create New Site

1. Go to https://netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose GitHub → Select "plexus-drive" repo

### 2. Configure Build

**Settings:**
- **Base directory**: frontend
- **Build command**: `npm run build`
- **Publish directory**: frontend/dist
- **Node version**: 18

### 3. Add Environment Variables

Go to "Site settings" → "Environment variables":

```
VITE_API_URL=https://plexus-drive-backend.onrender.com
VITE_BACKEND_URL=https://plexus-drive-backend.onrender.com
```

### 4. Deploy

1. Click "Deploy site"
2. Wait 2-3 minutes
3. Get your URL: `https://random-name-12345.netlify.app`

### 5. Update Backend FRONTEND_URL

1. Go back to Render
2. Update `FRONTEND_URL` to your Netlify URL
3. Click "Save Changes" (backend will redeploy)

---

## Part 6: Final Configuration

### 1. Test the Connection

1. Visit your Netlify URL
2. Try to sign up
3. Check if email is sent
4. Upload a file
5. Test all features

### 2. Custom Domain (Optional)

**Netlify:**
1. Go to "Domain settings"
2. Add custom domain
3. Follow DNS configuration

**Render:**
1. Go to "Settings" → "Custom Domain"
2. Add your API domain
3. Update CORS in backend

---

## Troubleshooting

### Backend sleeps on free tier
- **Issue**: First request after 15 min is slow
- **Solution**: Upgrade to paid ($7/month) or accept cold starts

### CORS errors
- **Check**: Frontend URL matches exactly in backend
- **Check**: No trailing slashes
- **Fix**: Update FRONTEND_URL in Render

### Database connection errors
- **Check**: DATABASE_URL is correct
- **Check**: Neon database is active
- **Fix**: Verify connection string

### Email not sending
- **Check**: Gmail App Password is correct
- **Check**: 2-Factor Auth enabled on Gmail
- **Fix**: Generate new App Password

### File uploads failing
- **Check**: Dropbox tokens are valid
- **Check**: Dropbox app has permissions
- **Fix**: Refresh Dropbox token

---

## Monitoring

### Check Backend Health
```
https://your-backend.onrender.com/health
```

### View Logs

**Render:**
1. Dashboard → Your Service → Logs

**Netlify:**
1. Dashboard → Your Site → Deploys → Deploy log

---

## Updating Your App

### Make Changes Locally
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Auto-Deployment
- Netlify: Auto-deploys on push (2-3 min)
- Render: Auto-deploys on push (3-5 min)

---

## Cost Breakdown

```
Netlify Frontend:     $0/month
Render Backend:       $0/month (with sleep)
Neon Database:        $0/month (3 GB)
Dropbox Storage:      $0/month (2 GB)
Gmail SMTP:           $0/month
Domain (optional):    $12/year

TOTAL: $0/month (or $1/month for domain)
```

---

## Upgrade Path (When You Need It)

### Remove Sleep Mode
- Render: $7/month for always-on
- Better response times

### More Storage
- Upgrade Dropbox: $11.99/month for 2TB
- OR use AWS S3: ~$1/month for 10GB

### More Database
- Neon:$19/month for 10GB
- OR PostgreSQL on DigitalOcean: $15/month

---

## Support

- **Backend issues**: Check Render logs
- **Frontend issues**: Check Netlify deploy logs
- **Database issues**: Check Neon console
- **Email issues**: Test Gmail SMTP connection

---

## 🎉 Congratulations!

Your Plexus Drive is now live and accessible worldwide!

**Share your URL**: `https://your-site.netlify.app`
