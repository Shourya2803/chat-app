# Notification System Setup Guide

## ✅ What's Been Added

Your chat app now has a **complete 3-tier notification system**:

1. **📱 In-App Notifications** - Bell icon with stored notifications
2. **🔔 Push Notifications** - Firebase Cloud Messaging (browser push)
3. **📧 Email Notifications** - Resend email service

---

## 🛠️ Backend Setup (Complete)

### Database ✅
- Notification table created in PostgreSQL
- Fields: id, userId, type, title, body, actionUrl, metadata, isRead, readAt
- Indexes optimized for performance

### Services ✅
- `notification.service.ts` - Manages in-app notifications
- `email.service.ts` - Sends emails via Resend API
- `fcm.service.ts` - Sends push notifications via Firebase

### API Routes ✅
- `GET /api/notifications` - Get all notifications (paginated)
- `GET /api/notifications/unread` - Get unread count
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Real-Time Events ✅
- Socket.IO emits `new-notification` event when messages sent
- Frontend listens and updates bell icon in real-time

---

## 📧 Email Notifications Setup (Required)

### 1. Get Resend API Key

1. Go to **https://resend.com/signup**
2. Create a free account (100 emails/day, 3,000/month)
3. Get your API key from **https://resend.com/api-keys**

### 2. Add to Backend Environment

Edit `backend/.env`:

```env
# Email Notifications (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=notifications@yourdomain.com
```

**Note**: On free tier, you can only send from `onboarding@resend.dev`. To use a custom domain:
- Go to Resend dashboard → Domains
- Add your domain and verify DNS records
- Use `notifications@yourdomain.com`

### 3. Restart Backend Server

```bash
cd backend
npm run dev
```

---

## 🔔 Firebase Push Notifications (Already Configured)

Your FCM is already set up with these environment variables:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### How It Works:
1. User opens app in browser
2. Browser requests notification permission
3. FCM token registered in database
4. When user receives message while offline/in background → Push notification sent

---

## 🎨 Frontend Setup (Complete)

### Components ✅
- `NotificationBell.tsx` - Bell icon with badge, dropdown menu
- Integrated into `ChatLayout.tsx` - Shows in top-right corner

### Features:
- **Red badge** showing unread count (99+ max)
- **Dropdown menu** with:
  - List of notifications (newest first)
  - "Mark all as read" button
  - Individual delete buttons
  - Click notification → Navigate to chat
- **Real-time updates** via Socket.IO
- **Browser notifications** (if permission granted)

---

## 🚀 Testing the System

### Test In-App Notifications:
1. Open app as User A
2. Open app as User B (different browser/incognito)
3. Send message from User A
4. User B sees **red badge** on bell icon
5. Click bell → See notification
6. Click notification → Opens chat

### Test Push Notifications (FCM):
1. Open app and grant notification permission when prompted
2. **Close the browser tab or minimize it**
3. Send message from another user
4. You should see **browser push notification**

### Test Email Notifications:
1. Configure RESEND_API_KEY in backend/.env
2. Set `sendEmail: true` in notification creation (line 316 of server.ts)
3. Send message
4. Check receiver's email inbox
5. Click "View Message" button in email

---

## ⚙️ Configuration Options

### Control Notification Types

In `backend/server.ts` (line ~316), you can control which notifications to send:

```typescript
await notificationService.createNotification({
  // ... notification data
  sendPush: true,   // Firebase push notification (FCM)
  sendEmail: false, // Email via Resend (set true to enable)
});
```

**Recommended Settings:**
- `sendPush: true` - Always enable for instant notifications
- `sendEmail: false` - Only for important notifications (avoid spam)

### Email Notification Types

You can customize when to send emails:
- Every message: `sendEmail: true` (not recommended - too many emails)
- Mentions only: Check if message contains `@username`
- After X messages: Track message count, send digest
- Daily summary: Use cron job to send daily digest

---

## 🐛 Troubleshooting

### Bell Icon Not Showing
- Check if `NotificationBell` is imported in `ChatLayout.tsx`
- Verify user is authenticated (bell only shows when logged in)

### Notifications Not Appearing
1. Check backend console for errors
2. Verify Socket.IO connection in browser console
3. Run: `npx prisma db push` if table missing

### Push Notifications Not Working
1. Grant browser notification permission
2. Verify FCM credentials in backend/.env
3. Check browser console for FCM token registration
4. Ensure browser supports FCM (Chrome, Firefox, Edge)

### Emails Not Sending
1. Verify RESEND_API_KEY is correct
2. Check backend logs: `❌ No RESEND_API_KEY found` = missing key
3. Free tier: Use `onboarding@resend.dev` as FROM_EMAIL
4. Custom domain: Verify DNS records in Resend dashboard

### Clerk JWT Token Expiring
If you see "Token expired" errors:
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **Sessions** settings
4. Increase "Session token lifetime" to 10-60 minutes
5. Save and sign out/in again

---

## 📊 Database Schema

```prisma
model Notification {
  id          String   @id @default(uuid())
  userId      String
  type        String   // 'message', 'reaction', 'mention', 'system'
  title       String
  body        String
  actionUrl   String?  // URL to navigate when clicked
  metadata    Json?    // Additional data (messageId, senderId, etc.)
  isRead      Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id])
  
  @@index([userId, isRead, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
}
```

---

## 🎯 Next Steps

### Immediate:
1. ✅ Test notification bell in browser
2. ✅ Verify real-time updates work
3. ⏳ Get Resend API key and configure email
4. ⏳ Test email notifications

### Optional Enhancements:
- Add notification preferences (per user)
- Implement notification categories (messages, reactions, mentions)
- Add "Snooze" functionality
- Create daily digest email
- Add sound effects for new notifications
- Implement "Do Not Disturb" mode

---

## 📚 API Documentation

### GET /api/notifications
```typescript
// Request
GET http://localhost:4000/api/notifications?page=1&limit=20
Authorization: Bearer <clerk-jwt-token>

// Response
{
  "notifications": [
    {
      "id": "uuid",
      "type": "message",
      "title": "New message from John",
      "body": "Hey, how are you?",
      "actionUrl": "/chat?conversation=conv-id",
      "isRead": false,
      "createdAt": "2025-12-17T10:30:00Z",
      "metadata": {
        "messageId": "msg-id",
        "senderId": "user-id"
      }
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET /api/notifications/unread
```typescript
// Response
{ "unreadCount": 5 }
```

### PUT /api/notifications/:id/read
```typescript
// Marks single notification as read
{ "message": "Notification marked as read" }
```

### PUT /api/notifications/read-all
```typescript
// Marks all user's notifications as read
{ "message": "All notifications marked as read" }
```

### DELETE /api/notifications/:id
```typescript
// Deletes notification
{ "message": "Notification deleted" }
```

---

## 🎉 You're All Set!

Your chat app now has a **professional notification system** with:
- ✅ Real-time bell icon with badge
- ✅ Stored notifications (persistent)
- ✅ Push notifications (FCM)
- ✅ Email notifications (Resend)
- ✅ Mark as read/delete functionality
- ✅ Socket.IO real-time updates

Just add your **RESEND_API_KEY** and you're production-ready! 🚀
