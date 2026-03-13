# 🚀 Quick Deployment Checklist

Use this checklist to ensure smooth deployment.

## Before You Start

- [ ] GitHub account created
- [ ] Code pushed to GitHub
- [ ] All features tested locally
- [ ] `.env` file has all required values

---

## 1. Database Setup (Neon.tech) ☐

- [ ] Sign up at neon.tech
- [ ] Create project "plexus-drive"
- [ ] Copy connection string
- [ ] Run `database.sql` in SQL Editor
- [ ] No extra migration files needed (already consolidated)
- [ ] Verify tables created

**Connection String:**
```
postgresql://user:pass@host.neon.tech/plexus_db
```

---

## 2. Backend Setup (Render.com) ☐

- [ ] Sign up at render.com
- [ ] Create new Web Service
- [ ] Connect GitHub repo
- [ ] Set root directory: `backend`
- [ ] Set build command: `npm install`
- [ ] Set start command: `npm start`

### Environment Variables:
- [ ] NODE_ENV=production
- [ ] PORT=5000
- [ ] DATABASE_URL (from Neon)
- [ ] JWT_SECRET (generate random)
- [ ] FRONTEND_URL (will add after frontend deploy)
- [ ] EMAIL_HOST=smtp.gmail.com
- [ ] EMAIL_PORT=587
- [ ] EMAIL_USER (your Gmail)
- [ ] EMAIL_PASS (Gmail App Password)
- [ ] EMAIL_FROM (your Gmail)
- [ ] DROPBOX_APP_KEY
- [ ] DROPBOX_APP_SECRET
- [ ] DROPBOX_REFRESH_TOKEN

- [ ] Deploy backend
- [ ] Copy backend URL
- [ ] Test `/health` endpoint

---

## 3. Frontend Setup (Netlify.com) ☐

- [ ] Sign up at netlify.com
- [ ] Import GitHub project
- [ ] Set base directory: `frontend`
- [ ] Set build command: `npm run build`
- [ ] Set publish directory: `frontend/dist`

### Environment Variables:
- [ ] VITE_API_URL (your Render backend URL)
- [ ] VITE_BACKEND_URL (your Render backend URL)

- [ ] Deploy frontend
- [ ] Copy frontend URL

---

## 4. Connect Frontend & Backend ☐

- [ ] Go to Render dashboard
- [ ] Update FRONTEND_URL env variable
- [ ] Save (backend will redeploy)
- [ ] Wait 3-5 minutes

---

## 5. Testing ☐

- [ ] Visit frontend URL
- [ ] Sign up new account
- [ ] Check email received
- [ ] Verify email
- [ ] Login
- [ ] Upload a file
- [ ] Share a file
- [ ] Search files
- [ ] Test AI analysis (if worker deployed)

---

## 6. Optional: Background Worker ☐

If you want AI analysis to run in background:

- [ ] In Render, create Background Worker
- [ ] Same repo, root: `backend`
- [ ] Start command: `node worker.js`
- [ ] Copy same env variables
- [ ] Deploy worker

---

## 7. Optional: Custom Domain ☐

### Netlify:
- [ ] Buy domain (Namecheap, GoDaddy)
- [ ] Add domain in Netlify settings
- [ ] Update DNS records
- [ ] Wait for SSL certificate

### Render:
- [ ] Add custom domain in settings
- [ ] Update DNS CNAME record
- [ ] Update FRONTEND_URL in backend

---

## Common Issues & Fixes

### ❌ CORS Error
- **Fix**: Make sure FRONTEND_URL in backend matches Netlify URL exactly
- **Fix**: No trailing slash in URLs

### ❌ Database Connection Failed
- **Fix**: Check DATABASE_URL is correct
- **Fix**: Verify Neon database is active

### ❌ Email Not Sending
- **Fix**: Enable 2-Factor Auth on Gmail
- **Fix**: Generate new App Password
- **Fix**: Use App Password, not regular password

### ❌ Files Not Uploading
- **Fix**: Check Dropbox tokens are valid
- **Fix**: Verify Dropbox app permissions

### ❌ Backend Slow
- **Note**: Free tier sleeps after 15 min
- **Note**: First request wakes it (30 sec delay)
- **Solution**: Upgrade to paid ($7/month) OR accept it

---

## Verification URLs

**Frontend**: https://your-site.netlify.app
**Backend**: https://your-backend.onrender.com
**Health Check**: https://your-backend.onrender.com/health
**API Test**: https://your-backend.onrender.com/api/auth/register

---

## Post-Deployment

- [ ] Share your app URL with friends!
- [ ] Monitor Render logs for errors
- [ ] Check Netlify analytics
- [ ] Set up monitoring (optional)
- [ ] Add to portfolio/resume

---

## Costs

**Free Tier:**
- Netlify: $0/month (unlimited)
- Render: $0/month (with sleep)
- Neon: $0/month (3 GB)
- **TOTAL: $0/month** ✅

**Upgrade (Optional):**
- Render Pro: $7/month (no sleep)
- Custom domain: $12/year
- More storage: as needed

---

## Need Help?

1. Check DEPLOYMENT.md for detailed guide
2. Check Render logs for backend errors
3. Check Netlify logs for frontend errors
4. Check browser console for frontend errors
5. Test `/health` endpoint

---

**DEPLOYMENT TIME: ~30-45 minutes** ⏱️

Good luck! 🚀
