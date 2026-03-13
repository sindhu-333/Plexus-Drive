# Instructions to Prevent Emails Going to Spam

## For the SENDER (your Gmail account):

1. **Add a Custom Email Signature:**
   - Go to Gmail Settings → Signature
   - Add a simple signature to make emails look more legitimate

2. **Send from Verified Domain (Optional - Advanced):**
   - Consider using a custom domain with SPF/DKIM records
   - Current setup uses Gmail directly, which should work fine

## For the RECIPIENT (phone):

### If Emails Are Going to Spam:

1. **Mark as Not Spam:**
   - Open the email in Spam folder
   - Tap "Not Spam" or "Move to Inbox"
   - This trains Gmail's filter

2. **Add to Contacts:**
   - Add "sindhubhat39@gmail.com" to your phone contacts
   - Gmail trusts emails from contacts

3. **Create a Filter:**
   - On Gmail web:
     - Settings → Filters and Blocked Addresses → Create new filter
     - From: sindhubhat39@gmail.com
     - Check "Never send to Spam"
     - Check "Always mark as important"
   - On Gmail mobile:
     - Open an email from yourself
     - Tap three dots (⋮) → Filter messages like this
     - Create filter to never send to spam

### Gmail Mobile App Settings:

1. **Enable Notifications:**
   - Phone Settings → Apps → Gmail → Notifications → Enable All

2. **Disable Battery Optimization:**
   - Phone Settings → Apps → Gmail → Battery → Don't optimize
   - This ensures real-time sync

3. **Check Sync Settings:**
   - Gmail app → Menu → Settings → Your Account
   - Sync frequency: Auto
   - Days of mail to sync: 30 days or more

4. **Enable High-Priority Notifications:**
   - Gmail app → Settings → Your Account → Notifications
   - Enable "All" or at least "High priority only"

## Testing:

After making these changes:
1. Send another test email (run: node backend/test-email.js)
2. Check your phone within 1-2 minutes
3. If still not appearing, check web Gmail

## Common Reasons for Missing Emails on Phone:

- ✅ Email IS sent (confirmed by test)
- ✅ Gmail servers accepted it (confirmed by test)
- ⚠️  Gmail spam filter catching it (most likely)
- ⚠️  Gmail app not syncing properly
- ⚠️  Notifications disabled
- ⚠️  Battery optimization killing Gmail sync

## Quick Fix Command:

Run this anytime to send a test email to yourself:
```bash
cd backend
node test-email.js
```

Then check your phone!
