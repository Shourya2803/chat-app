# Email Notifications & Uptime Robot Setup Guide

## 📧 Email Notifications Setup

Your chat app has email notification capability built-in, but you need to configure the **Resend API key** to enable it.

### Step 1: Get Resend API Key

1. **Sign up for Resend** (Free tier: 100 emails/day, 3,000/month)
   - Visit: https://resend.com/signup
   - Create your account

2. **Get your API key**
   - Go to: https://resend.com/api-keys
   - Click "Create API Key"
   - Copy the key (starts with `re_...`)

### Step 2: Add to Environment Variables

Edit `backend/.env` and add:

```env
# Email Notifications (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=onboarding@resend.dev
```

**Note**: 
- On free tier, you can only send from `onboarding@resend.dev`
- To use a custom domain (e.g., `notifications@yourdomain.com`):
  1. Go to Resend Dashboard → Domains
  2. Add your domain
  3. Verify DNS records (SPF, DKIM, DMARC)
  4. Update `FROM_EMAIL` to your custom address

### Step 3: Restart Backend Server

```bash
cd backend
npm run dev
```

### Step 4: Test Email Notifications

1. Open `backend/server.ts` and find line ~316
2. Change `sendEmail: false` to `sendEmail: true`:

```typescript
await notificationService.createNotification({
  // ... other fields
  sendPush: true,
  sendEmail: true,  // Enable email notifications
});
```

3. Restart backend
4. Send a message from one user to another
5. Check the receiver's email inbox

**Current Status**: 
- ❌ Email notifications are DISABLED (no RESEND_API_KEY found)
- ✅ Push notifications (FCM) are working
- ✅ In-app notifications are working

---

## 🤖 UptimeRobot Setup (Cron Jobs)

Your app has a cron job that sends unread message reminders every 2 hours. It's designed to be triggered by UptimeRobot.

### What the Cron Job Does

- **Endpoint**: `POST http://your-backend-url/api/cron/unread-reminder`
- **Frequency**: Every 2 hours (but UptimeRobot pings every 5 minutes)
- **Function**: Sends push notifications to users with unread messages
- **Smart Throttling**: Uses Redis to ensure it only runs once every 2 hours, even if pinged more frequently

### Step 1: Deploy Your Backend

First, deploy your backend to a platform with a public URL:
- **Recommended**: Railway, Render, or Heroku
- **Not supported**: Vercel (no WebSocket/long-running processes)

### Step 2: Create UptimeRobot Account

1. Go to: https://uptimerobot.com/
2. Sign up for free account
3. Verify your email

### Step 3: Add HTTP Monitor

1. Click **"+ Add New Monitor"**
2. Configure:

```
Monitor Type: HTTP(s)
Friendly Name: Chat App Cron - Unread Reminders
URL: https://your-backend-url.com/api/cron/unread-reminder
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
HTTP Method: POST
HTTP Content Type: application/json
```

3. Click **"Create Monitor"**

### Step 4: Verify It's Working

1. Check UptimeRobot dashboard for successful pings (green status)
2. Check backend logs:
   ```
   ✅ Unread reminder cron triggered
   📊 Found X users with unread messages
   ✅ Sent Y push notifications
   ```
3. Check Redis logs (optional):
   ```
   ✅ Updated last run timestamp
   ```

### Step 5: Monitor Performance

In UptimeRobot dashboard, you'll see:
- **Uptime percentage** (should be 99%+)
- **Response time** (should be under 5 seconds)
- **Status**: Up (green) or Down (red)

### Troubleshooting

**Monitor shows "Down":**
- Check if backend server is running
- Verify the URL is correct and publicly accessible
- Check backend logs for errors

**Cron not executing:**
- Check backend logs for `"Skipping cron execution (within 2-hour interval)"`
- This is normal! The cron only runs once every 2 hours
- UptimeRobot pings every 5 minutes, but Redis prevents duplicate executions

**No push notifications sent:**
- Check if users have FCM tokens registered
- Verify Firebase credentials in `.env`
- Check backend logs for FCM errors

---

## 🎯 Current Setup Status

### ✅ Working Features
- In-app notification bell with badge
- Real-time typing indicators (now showing!)
- Push notifications (FCM)
- WhatsApp-style unread message counts
- Cron job endpoint ready

### ⏳ Needs Configuration
- **Email notifications**: Add RESEND_API_KEY
- **UptimeRobot**: Create account and add monitor
- **Clerk JWT expiration**: Increase token lifetime in Clerk Dashboard

### 📊 Performance Targets

**Real-time updates:**
- ✅ Typing indicators: Instant (< 1 second)
- ✅ New messages: Instant via Socket.IO
- ✅ User status: Instant (online/offline)
- ✅ Unread counts: Instant update

**Push notifications:**
- ✅ In-app: Instant
- ✅ FCM: 1-5 seconds delay (normal for push notifications)
- ⏳ Email: 1-10 seconds delay (after RESEND_API_KEY configured)

**Cron jobs:**
- ✅ Unread reminders: Every 2 hours
- ✅ Health checks: Every 5 minutes via UptimeRobot

---

## 🔧 Advanced Configuration

### Email Notification Preferences

You can customize when emails are sent by modifying the notification creation:

```typescript
// In backend/server.ts

// Option 1: Send email for every message (not recommended - spam)
sendEmail: true

// Option 2: Only for mentions
sendEmail: messageContent.includes('@username')

// Option 3: Only if user is offline
sendEmail: receiverStatus === 'offline'

// Option 4: After X unread messages
sendEmail: unreadCount >= 5
```

### Custom Cron Jobs

You can add more cron jobs in `backend/src/routes/cron.routes.ts`:

```typescript
// Example: Daily digest
router.post('/daily-digest', async (req, res) => {
  // Send daily summary of conversations
});

// Example: Cleanup old notifications
router.post('/cleanup-notifications', async (req, res) => {
  // Delete notifications older than 30 days
});
```

Then add monitors in UptimeRobot for each endpoint.

---

## 📝 Quick Start Checklist

### To Enable Email Notifications:
1. ☐ Sign up at https://resend.com
2. ☐ Get API key from https://resend.com/api-keys
3. ☐ Add `RESEND_API_KEY` to `backend/.env`
4. ☐ Add `FROM_EMAIL=onboarding@resend.dev` to `backend/.env`
5. ☐ Change `sendEmail: true` in server.ts (line ~316)
6. ☐ Restart backend
7. ☐ Test by sending a message

### To Setup UptimeRobot:
1. ☐ Deploy backend to Railway/Render
2. ☐ Sign up at https://uptimerobot.com
3. ☐ Add HTTP monitor pointing to `/api/cron/unread-reminder`
4. ☐ Set interval to 5 minutes
5. ☐ Set method to POST
6. ☐ Verify monitor status is "Up"

### To Fix Clerk JWT Expiration:
1. ☐ Go to https://dashboard.clerk.com
2. ☐ Select your application
3. ☐ Go to "Sessions" settings
4. ☐ Increase "Session token lifetime" to 10-60 minutes
5. ☐ Save changes
6. ☐ Sign out and sign in again

---

## 🚀 Production Deployment Tips

1. **Environment Variables**: Set all required env vars in your hosting platform
2. **Redis Connection**: Use connection pooling for better performance
3. **Database**: Enable connection pooling in Prisma
4. **Monitoring**: Set up UptimeRobot for all critical endpoints
5. **Logging**: Use structured logging for better debugging
6. **Error Tracking**: Consider adding Sentry or similar
7. **Email Limits**: Monitor Resend usage (100/day on free tier)

---

## 🆘 Support

If you encounter issues:
1. Check backend logs for errors
2. Verify all environment variables are set
3. Test each service individually (FCM, Resend, Redis)
4. Check UptimeRobot dashboard for monitor status
5. Ensure Clerk token lifetime is set correctly

**Common Issues:**
- "RESEND_API_KEY not found" → Add the key to `.env`
- "Firebase not initialized" → Check Firebase credentials
- "Cron not executing" → Normal if within 2-hour interval
- "Token expired" → Increase Clerk token lifetime
- "UptimeRobot shows Down" → Check if backend is publicly accessible

---

## ✅ You're All Set!

With this setup:
- ✅ Real-time typing indicators working
- ✅ Messages update instantly
- ✅ Unread counts show next to sender names (WhatsApp style)
- ✅ Notification bell shows all notifications
- ⏳ Email notifications (after adding RESEND_API_KEY)
- ⏳ Automated cron jobs (after setting up UptimeRobot)

Everything is optimized for **real-time performance** with updates happening instantly or within 1-5 seconds! 🚀
