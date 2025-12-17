# PROFESSIONAL MESSAGE FEATURES - IMPLEMENTATION GUIDE
## Complete Reference for Real-Time Chat Features

This guide covers all professional message-level features implemented in the chat application: Read Receipts, Typing Indicators, Message Edit/Delete, Message Reactions, FCM Push Notifications, and UptimeRobot Cron Integration.

---

## 📚 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Socket.IO Events](#socketio-events)
4. [Service Layer](#service-layer)
5. [Frontend Integration](#frontend-integration)
6. [Firebase FCM Setup](#firebase-fcm-setup)
7. [UptimeRobot Configuration](#uptimerobot-configuration)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### Technology Stack
```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                    │
│  Next.js 14 + Socket.IO Client + React State           │
└───────────────────┬─────────────────────────────────────┘
                    │ WebSocket Connection
                    │ HTTPS REST API
┌───────────────────┴─────────────────────────────────────┐
│                   BACKEND (Render)                      │
│  Node.js + Express + Socket.IO Server                   │
├─────────────────────────────────────────────────────────┤
│  Services Layer:                                        │
│  - Read Receipts Service                                │
│  - Typing Indicators Service                            │
│  - Message Mutation Service (Edit/Delete)               │
│  - Message Reactions Service                            │
│  - FCM Notification Service                             │
├─────────────────────────────────────────────────────────┤
│  Data Layer:                                            │
│  - PostgreSQL (via Prisma ORM)                          │
│  - Redis (Presence + Typing + Cron)                     │
│  - Firebase Cloud Messaging                             │
└─────────────────────────────────────────────────────────┘
                    │
                    │ 5-minute pings
┌───────────────────┴─────────────────────────────────────┐
│              UPTIMEROBOT (Cron Scheduler)               │
│  Triggers /api/cron/unread-reminder every 5 minutes     │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Patterns

**Real-time Events (Socket.IO)**
- Read receipts
- Typing indicators
- Message edits/deletes
- Reactions

**Push Notifications (FCM)**
- Offline message notifications
- Unread reminders

**Scheduled Tasks (UptimeRobot)**
- Unread message reminders (2-hour intervals)
- Token cleanup (24-hour intervals)

---

## 🗄️ Database Schema

### New Models

#### MessageRead
```prisma
model MessageRead {
  id          String   @id @default(uuid())
  messageId   String
  userId      String
  readAt      DateTime @default(now())
  createdAt   DateTime @default(now())
  
  message     Message  @relation("MessageReads", fields: [messageId], references: [id], onDelete: Cascade)
  user        User     @relation("MessageReads", fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([messageId, userId]) // Idempotency constraint
  @@index([messageId])
  @@index([userId])
}
```

**Purpose**: Per-user read receipts with idempotency guarantee

#### MessageReaction
```prisma
model MessageReaction {
  id          String   @id @default(uuid())
  messageId   String
  userId      String
  emoji       String   // e.g., "👍", "❤️", "😂"
  createdAt   DateTime @default(now())
  
  message     Message  @relation("MessageReactions", fields: [messageId], references: [id], onDelete: Cascade)
  user        User     @relation("MessageReactions", fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([messageId, userId, emoji]) // Toggle constraint
  @@index([messageId])
  @@index([userId])
}
```

**Purpose**: Emoji reactions with toggle support

#### Enhanced Message Model
```prisma
model Message {
  // Existing fields...
  
  // New edit/delete fields
  isEdited        Boolean  @default(false)
  editedAt        DateTime?
  isDeleted       Boolean  @default(false)
  deletedAt       DateTime?
  
  // New relations
  messageReads    MessageRead[]    @relation("MessageReads")
  reactions       MessageReaction[] @relation("MessageReactions")
  
  @@index([isDeleted, conversationId])
}
```

#### Enhanced FcmToken Model
```prisma
model FcmToken {
  id          String   @id @default(uuid())
  userId      String
  token       String   @unique
  deviceName  String?
  isActive    Boolean  @default(true)
  lastUsedAt  DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, isActive])
  @@index([isActive])
}
```

**Purpose**: Multi-device FCM token management with health tracking

### Migration
```bash
cd backend
npx prisma migrate dev --name add_message_features
npx prisma generate
```

---

## 🔌 Socket.IO Events

### Client → Server Events

#### message:read
Mark a message as read
```typescript
socket.emit('message:read', {
  messageId: 'msg-uuid',
  conversationId: 'conv-uuid',
});
```

#### typing:start
Start typing indicator
```typescript
socket.emit('typing:start', {
  conversationId: 'conv-uuid',
});
```

#### typing:stop
Stop typing indicator
```typescript
socket.emit('typing:stop', {
  conversationId: 'conv-uuid',
});
```

#### message:edit
Edit a message (within 5-minute window)
```typescript
socket.emit('message:edit', {
  messageId: 'msg-uuid',
  conversationId: 'conv-uuid',
  newContent: 'Updated message text',
});
```

#### message:delete
Delete a message (within 5-minute window)
```typescript
socket.emit('message:delete', {
  messageId: 'msg-uuid',
  conversationId: 'conv-uuid',
});
```

#### message:react
React to a message with emoji (toggle)
```typescript
socket.emit('message:react', {
  messageId: 'msg-uuid',
  conversationId: 'conv-uuid',
  emoji: '👍',
});
```

### Server → Client Events

#### message:read:update
Broadcast read receipt
```typescript
socket.on('message:read:update', (data) => {
  // data: { messageId, conversationId, userId, username, readAt }
  console.log(`${data.username} read the message at ${data.readAt}`);
});
```

#### user:typing
Broadcast typing status
```typescript
socket.on('user:typing', (data) => {
  // data: { conversationId, userId, username, isTyping }
  if (data.isTyping) {
    console.log(`${data.username} is typing...`);
  }
});
```

#### message:edited
Broadcast message edit
```typescript
socket.on('message:edited', (data) => {
  // data: { messageId, conversationId, newContent, editedAt, senderId }
  console.log(`Message edited: ${data.newContent}`);
});
```

#### message:deleted
Broadcast message deletion
```typescript
socket.on('message:deleted', (data) => {
  // data: { messageId, conversationId, deletedAt, senderId }
  console.log(`Message deleted at ${data.deletedAt}`);
});
```

#### message:reaction:added
Broadcast reaction added
```typescript
socket.on('message:reaction:added', (data) => {
  // data: { messageId, conversationId, userId, username, emoji, reactionCounts }
  console.log(`${data.username} reacted with ${data.emoji}`);
  console.log('Counts:', data.reactionCounts); // { "👍": 3, "❤️": 2 }
});
```

#### message:reaction:removed
Broadcast reaction removed
```typescript
socket.on('message:reaction:removed', (data) => {
  // data: { messageId, conversationId, userId, username, emoji, reactionCounts }
  console.log(`${data.username} removed ${data.emoji} reaction`);
});
```

#### message-error
Error response
```typescript
socket.on('message-error', (error) => {
  // error: { error: string, code?: string }
  console.error(`Error: ${error.error}`);
});
```

---

## 🛠️ Service Layer

### Read Receipts Service

```typescript
import { readReceiptsService } from './services/read-receipts.service';

// Mark message as read (idempotent)
const receipt = await readReceiptsService.markMessageAsRead(messageId, userId);

// Get all read receipts for a message
const receipts = await readReceiptsService.getMessageReadReceipts(messageId);

// Batch check read status
const readMap = await readReceiptsService.getBatchReadStatus(messageIds, userId);

// Check if all participants have read
const allRead = await readReceiptsService.hasAllRead(messageId, conversationId);
```

### Typing Indicators Service

```typescript
import { typingIndicatorsService } from './services/typing.service';

// Set typing (auto-throttled)
const processed = await typingIndicatorsService.setTyping(conversationId, userId, username);

// Stop typing
await typingIndicatorsService.stopTyping(conversationId, userId);

// Get all typing users
const typingUsers = await typingIndicatorsService.getTypingUsers(conversationId);

// Check if specific user is typing
const isTyping = await typingIndicatorsService.isUserTyping(conversationId, userId);
```

### Message Mutation Service

```typescript
import { messageMutationService } from './services/message-mutation.service';

// Edit message (with validation)
try {
  const updated = await messageMutationService.editMessage(messageId, userId, newContent);
} catch (error) {
  // Handle: time window expired, not sender, etc.
}

// Delete message (soft delete)
try {
  const deleted = await messageMutationService.deleteMessage(messageId, userId);
} catch (error) {
  // Handle: time window expired, not sender, etc.
}

// Check permissions
const { canEdit, reason } = await messageMutationService.canEditMessage(messageId, userId);
const { canDelete, reason } = await messageMutationService.canDeleteMessage(messageId, userId);

// Get edit history
const history = await messageMutationService.getEditHistory(messageId);
```

### Message Reactions Service

```typescript
import { messageReactionsService } from './services/reactions.service';

// Toggle reaction (add or remove)
const result = await messageReactionsService.toggleReaction(messageId, userId, emoji, username);
// result.action: 'added' | 'removed'
// result.counts: { "👍": 3, "❤️": 2 }

// Get reaction counts
const counts = await messageReactionsService.getReactionCounts(messageId);

// Get detailed reactions with user info
const detailed = await messageReactionsService.getDetailedReactions(messageId);

// Check if user reacted
const hasReacted = await messageReactionsService.hasUserReacted(messageId, userId, emoji);

// Remove all reactions (e.g., when message deleted)
await messageReactionsService.removeAllReactions(messageId);
```

### FCM Notification Service

```typescript
import { fcmNotificationService } from './services/fcm.service';

// Send notification (only if offline)
await fcmNotificationService.sendNotificationIfOffline(
  userId,
  {
    title: 'New Message',
    body: 'You have a new message from John',
    imageUrl: 'https://example.com/avatar.jpg',
  },
  {
    type: 'new-message',
    messageId: 'msg-uuid',
    conversationId: 'conv-uuid',
  }
);

// Send silent data message (background sync)
await fcmNotificationService.sendSilentDataMessage(
  userId,
  {
    type: 'message-update',
    messageId: 'msg-uuid',
  }
);

// Register FCM token
await fcmNotificationService.registerToken(userId, fcmToken, 'iPhone 12');

// Deactivate token
await fcmNotificationService.deactivateToken(fcmToken);

// Cleanup expired tokens (cron job)
await fcmNotificationService.cleanupExpiredTokens();
```

---

## 💻 Frontend Integration

### Socket.IO Client Setup

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket.types';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  connect(token: string) {
    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Listen to all server events
    this.socket.on('message:read:update', this.handleReadUpdate);
    this.socket.on('user:typing', this.handleTyping);
    this.socket.on('message:edited', this.handleMessageEdit);
    this.socket.on('message:deleted', this.handleMessageDelete);
    this.socket.on('message:reaction:added', this.handleReactionAdded);
    this.socket.on('message:reaction:removed', this.handleReactionRemoved);
  }

  // Read receipts
  markAsRead(messageId: string, conversationId: string) {
    this.socket?.emit('message:read', { messageId, conversationId });
  }

  // Typing indicators
  startTyping(conversationId: string) {
    this.socket?.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string) {
    this.socket?.emit('typing:stop', { conversationId });
  }

  // Message edit
  editMessage(messageId: string, conversationId: string, newContent: string) {
    this.socket?.emit('message:edit', { messageId, conversationId, newContent });
  }

  // Message delete
  deleteMessage(messageId: string, conversationId: string) {
    this.socket?.emit('message:delete', { messageId, conversationId });
  }

  // Reactions
  reactToMessage(messageId: string, conversationId: string, emoji: string) {
    this.socket?.emit('message:react', { messageId, conversationId, emoji });
  }

  // Event handlers
  private handleReadUpdate = (data: any) => {
    // Update UI to show read status
    console.log('Read receipt:', data);
  };

  private handleTyping = (data: any) => {
    // Show/hide "User is typing..." indicator
    console.log('Typing:', data);
  };

  private handleMessageEdit = (data: any) => {
    // Update message in UI with "(edited)" label
    console.log('Message edited:', data);
  };

  private handleMessageDelete = (data: any) => {
    // Update message in UI to show "[Message deleted]"
    console.log('Message deleted:', data);
  };

  private handleReactionAdded = (data: any) => {
    // Update reaction counts in UI
    console.log('Reaction added:', data);
  };

  private handleReactionRemoved = (data: any) => {
    // Update reaction counts in UI
    console.log('Reaction removed:', data);
  };
}

export const socketService = new SocketService();
```

### React Component Example

```typescript
// components/chat/MessageItem.tsx
import { useState } from 'react';
import { socketService } from '@/lib/socket';

interface MessageItemProps {
  message: {
    id: string;
    content: string;
    isEdited: boolean;
    isDeleted: boolean;
    reactions: Record<string, number>; // { "👍": 3 }
  };
  conversationId: string;
}

export function MessageItem({ message, conversationId }: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleEdit = () => {
    socketService.editMessage(message.id, conversationId, editContent);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      socketService.deleteMessage(message.id, conversationId);
    }
  };

  const handleReact = (emoji: string) => {
    socketService.reactToMessage(message.id, conversationId, emoji);
  };

  if (message.isDeleted) {
    return <div className="text-gray-400 italic">[Message deleted]</div>;
  }

  return (
    <div className="message">
      {isEditing ? (
        <input
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onBlur={handleEdit}
        />
      ) : (
        <p>{message.content} {message.isEdited && <span className="text-xs text-gray-500">(edited)</span>}</p>
      )}

      <div className="reactions">
        {Object.entries(message.reactions).map(([emoji, count]) => (
          <button key={emoji} onClick={() => handleReact(emoji)}>
            {emoji} {count}
          </button>
        ))}
      </div>

      <div className="actions">
        <button onClick={() => setIsEditing(true)}>Edit</button>
        <button onClick={handleDelete}>Delete</button>
        <button onClick={() => handleReact('👍')}>👍</button>
        <button onClick={() => handleReact('❤️')}>❤️</button>
      </div>
    </div>
  );
}
```

### Typing Indicator Component

```typescript
// components/chat/TypingIndicator.tsx
import { useEffect, useState } from 'react';
import { socketService } from '@/lib/socket';

export function TypingIndicator({ conversationId }: { conversationId: string }) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    const handleTyping = (data: { conversationId: string; username: string; isTyping: boolean }) => {
      if (data.conversationId !== conversationId) return;

      if (data.isTyping) {
        setTypingUsers((prev) => [...prev, data.username]);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u !== data.username));
      }
    };

    socketService.socket?.on('user:typing', handleTyping);

    return () => {
      socketService.socket?.off('user:typing', handleTyping);
    };
  }, [conversationId]);

  if (typingUsers.length === 0) return null;

  return (
    <div className="typing-indicator">
      {typingUsers.length === 1
        ? `${typingUsers[0]} is typing...`
        : `${typingUsers.length} people are typing...`}
    </div>
  );
}
```

---

## 🔥 Firebase FCM Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enable Cloud Messaging

### 2. Generate Service Account Key
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file

### 3. Environment Variables
```bash
# backend/.env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

### 4. Install Firebase SDK (Frontend)
```bash
cd frontend
npm install firebase
```

### 5. Frontend FCM Configuration
```typescript
// lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function registerFCMToken() {
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  });

  // Send token to backend
  await fetch('/api/fcm/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, deviceName: navigator.userAgent }),
  });

  return token;
}
```

### 6. Service Worker (public/firebase-messaging-sw.js)
```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  projectId: 'YOUR_PROJECT_ID',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

---

## ⏰ UptimeRobot Configuration

### 1. Create UptimeRobot Account
Sign up at [https://uptimerobot.com/](https://uptimerobot.com/)

### 2. Create Monitor

**Settings**:
- **Monitor Type**: HTTP(S)
- **Friendly Name**: Chat App - Unread Reminders
- **URL**: `https://your-backend.render.com/api/cron/unread-reminder`
- **Method**: POST
- **Monitoring Interval**: 5 minutes
- **Alert Contacts**: Your email

### 3. Add Token Cleanup Monitor (Optional)

**Settings**:
- **Monitor Type**: HTTP(S)
- **Friendly Name**: Chat App - Token Cleanup
- **URL**: `https://your-backend.render.com/api/cron/cleanup-tokens`
- **Method**: POST
- **Monitoring Interval**: 5 minutes

### 4. Verify Cron Execution
```bash
# Check Redis for last run timestamp
redis-cli GET cron:last-run:unread-reminder

# Check backend logs
curl https://your-backend.render.com/health
```

---

## 🧪 Testing Guide

### Manual Testing Checklist

#### Read Receipts
- [ ] User A sends message to User B
- [ ] User B marks message as read
- [ ] User A sees "✔✔ Seen" indicator
- [ ] Multiple users in group chat can mark as read independently

#### Typing Indicators
- [ ] User B starts typing
- [ ] User A sees "User B is typing..."
- [ ] Indicator disappears after 3 seconds of inactivity
- [ ] Indicator disappears when User B sends message

#### Message Edit
- [ ] User A edits message within 5 minutes → success
- [ ] User A tries to edit after 5 minutes → error
- [ ] User B tries to edit User A's message → error
- [ ] Edited message shows "(edited)" label

#### Message Delete
- [ ] User A deletes message within 5 minutes → success
- [ ] User A tries to delete after 5 minutes → error
- [ ] Deleted message shows "[Message deleted]"

#### Message Reactions
- [ ] User B reacts with "👍" → count shows 1
- [ ] User B clicks "👍" again → count shows 0 (removed)
- [ ] Multiple users react → counts aggregate correctly
- [ ] User can react with multiple different emojis

#### FCM Notifications
- [ ] User A sends message while User B is offline → User B receives push notification
- [ ] User A sends message while User B is online → No push notification
- [ ] Multi-device: User B receives notification on all devices

#### UptimeRobot Cron
- [ ] First ping executes job immediately
- [ ] Second ping within 2 hours skips execution
- [ ] Third ping after 2 hours executes job again

### Automated Testing

```typescript
// test/services/read-receipts.test.ts
import { readReceiptsService } from '../src/services/read-receipts.service';

describe('Read Receipts Service', () => {
  it('should mark message as read (idempotent)', async () => {
    const messageId = 'test-msg-id';
    const userId = 'test-user-id';

    // First call
    const receipt1 = await readReceiptsService.markMessageAsRead(messageId, userId);
    expect(receipt1).toBeDefined();

    // Second call (should not fail)
    const receipt2 = await readReceiptsService.markMessageAsRead(messageId, userId);
    expect(receipt2).toBeDefined();
  });
});
```

---

## 🐛 Troubleshooting

### Issue: Read receipts not showing
**Solution**: Check Socket.IO connection, verify user joined conversation room

### Issue: Typing indicators not clearing
**Solution**: Auto-expiration via Redis TTL handles this (3 seconds)

### Issue: FCM notifications not received
**Solution**: 
1. Check Firebase credentials
2. Verify FCM token registration
3. Check user presence in Redis (should be offline)
4. Review Firebase Console logs

### Issue: Message edit fails
**Solution**: Check time window (5 minutes), verify user is sender

### Issue: Cron runs too frequently
**Solution**: Check Redis persistence, verify `cron:last-run:*` key exists

---

## 📚 Related Documentation
- [Architecture Overview](../ARCHITECTURE.md)
- [Redis Key Design](./REDIS_KEYS.md)
- [Data Flows](./DATA_FLOWS.md)
- [Deployment Guide](./DEPLOYMENT.md)
