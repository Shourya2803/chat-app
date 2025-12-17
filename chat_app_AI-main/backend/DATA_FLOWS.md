# DATA FLOWS & SEQUENCE DIAGRAMS
## Real-time Message Features Architecture

This document provides detailed sequence diagrams and data flows for all professional message-level features implemented in the chat application.

---

## 📨 1. Read Receipts Flow

### User Journey
User A sends message → User B reads message → User A sees "✔✔ Seen"

### Sequence Diagram
```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Client A │         │ Socket.IO│         │ Database │         │ Client B │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ send-message       │                    │                    │
     ├───────────────────>│                    │                    │
     │                    │  Save Message      │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Emit new-message  │                    │
     │                    ├────────────────────────────────────────>│
     │                    │                    │                    │
     │                    │            message:read event           │
     │                    │<────────────────────────────────────────┤
     │                    │                    │                    │
     │                    │  Create MessageRead│                    │
     │                    ├───────────────────>│                    │
     │                    │  (upsert)          │                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │  message:read:     │                    │                    │
     │  update            │                    │                    │
     │<───────────────────┤                    │                    │
     │                    │                    │                    │
     │ Update UI          │                    │                    │
     │ Show ✔✔ Seen      │                    │                    │
     │                    │                    │                    │
```

### Database Operations
```sql
-- Upsert MessageRead (idempotent)
INSERT INTO "MessageRead" ("messageId", "userId", "readAt")
VALUES ($1, $2, NOW())
ON CONFLICT ("messageId", "userId")
DO UPDATE SET "readAt" = NOW();

-- Get read receipts for a message
SELECT mr."userId", mr."readAt", u."username", u."firstName", u."lastName"
FROM "MessageRead" mr
JOIN "User" u ON mr."userId" = u."id"
WHERE mr."messageId" = $1
ORDER BY mr."readAt" ASC;
```

### Key Features
- ✅ **Idempotent**: Unique constraint prevents duplicate reads
- ✅ **Group chat ready**: Multiple users can mark as read independently
- ✅ **Real-time**: Instant broadcast via Socket.IO
- ✅ **Timestamp tracking**: `readAt` field for precise timing

---

## ⌨️ 2. Typing Indicators Flow

### User Journey
User B types message → User A sees "User B is typing..." → Stops after 3 seconds or explicit stop

### Sequence Diagram
```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Client B │         │ Socket.IO│         │  Redis   │         │ Client A │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ typing:start       │                    │                    │
     ├───────────────────>│                    │                    │
     │                    │  Check throttle    │                    │
     │                    │  (in-memory)       │                    │
     │                    │                    │                    │
     │                    │  SETEX typing:     │                    │
     │                    │  conv:userId (3s)  │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Emit user:typing  │                    │
     │                    ├────────────────────────────────────────>│
     │                    │                    │                    │
     │                    │                    │  Auto-expire       │
     │                    │                    │  after 3 seconds   │
     │                    │                    │                    │
     │ typing:stop        │                    │                    │
     ├───────────────────>│                    │                    │
     │                    │  DEL typing:key    │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Emit user:typing  │                    │
     │                    │  (isTyping: false) │                    │
     │                    ├────────────────────────────────────────>│
     │                    │                    │                    │
```

### Redis Operations
```typescript
// Start typing (with TTL)
await redis.setex(
  `typing:${conversationId}:${userId}`,
  3, // 3 seconds TTL
  JSON.stringify({ userId, username, timestamp: Date.now() })
);

// Stop typing (manual)
await redis.del(`typing:${conversationId}:${userId}`);

// Get all typing users
const keys = await redis.keys(`typing:${conversationId}:*`);
const values = await redis.mget(...keys);
```

### Throttling Logic
```typescript
const THROTTLE_MS = 2000; // Max 1 event per 2 seconds
const throttleKey = `${userId}:${conversationId}`;
const lastEvent = throttleMap.get(throttleKey) || 0;

if (Date.now() - lastEvent < THROTTLE_MS) {
  return; // Skip event
}

throttleMap.set(throttleKey, Date.now());
```

### Key Features
- ✅ **Auto-expiration**: 3-second TTL removes stale state
- ✅ **Throttled**: Max 1 event per 2 seconds per user
- ✅ **No database writes**: Fully Redis-based
- ✅ **Memory efficient**: Keys auto-cleanup

---

## ✏️ 3. Message Edit Flow

### User Journey
User A edits message within 5 minutes → All users see "(edited)" indicator

### Sequence Diagram
```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Client A │         │ Socket.IO│         │ Database │         │ Client B │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ message:edit       │                    │                    │
     ├───────────────────>│                    │                    │
     │                    │  Validate:         │                    │
     │                    │  - Is sender?      │                    │
     │                    │  - Within 5 min?   │                    │
     │                    │  - Not deleted?    │                    │
     │                    │                    │                    │
     │                    │  UPDATE Message    │                    │
     │                    │  SET content=$1,   │                    │
     │                    │  isEdited=true,    │                    │
     │                    │  editedAt=NOW()    │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Broadcast         │                    │
     │                    │  message:edited    │                    │
     │                    ├────────────────────────────────────────>│
     │<───────────────────┤                    │                    │
     │                    │                    │                    │
     │ Update UI          │                    │  Update UI         │
     │ Show (edited)      │                    │  Show (edited)     │
     │                    │                    │                    │
```

### Database Operations
```sql
-- Edit message
UPDATE "Message"
SET "content" = $1,
    "is_edited" = true,
    "edited_at" = NOW(),
    "updated_at" = NOW()
WHERE "id" = $2
  AND "sender_id" = $3
  AND "is_deleted" = false
  AND (NOW() - "created_at") < INTERVAL '5 minutes'
RETURNING *;
```

### Validation Rules
```typescript
// Time window check
const messageAge = Date.now() - message.created_at.getTime();
if (messageAge > 5 * 60 * 1000) {
  throw new Error('Edit time window expired (5 minutes)');
}

// Permission check
if (message.sender_id !== userId) {
  throw new Error('Permission denied: Only sender can edit');
}

// Content validation
if (!newContent || newContent.trim().length === 0) {
  throw new Error('Message content cannot be empty');
}

if (newContent.length > 5000) {
  throw new Error('Message content too long (max 5000 characters)');
}
```

### Key Features
- ✅ **Time-limited**: 5-minute edit window
- ✅ **Permission-checked**: Only sender can edit
- ✅ **Audit trail**: `isEdited`, `editedAt` timestamps
- ✅ **Real-time**: Instant broadcast to all participants

---

## 🗑️ 4. Message Delete Flow

### User Journey
User A deletes message within 5 minutes → All users see "[Message deleted]"

### Sequence Diagram
```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Client A │         │ Socket.IO│         │ Database │         │ Client B │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ message:delete     │                    │                    │
     ├───────────────────>│                    │                    │
     │                    │  Validate:         │                    │
     │                    │  - Is sender?      │                    │
     │                    │  - Within 5 min?   │                    │
     │                    │  - Not already     │                    │
     │                    │    deleted?        │                    │
     │                    │                    │                    │
     │                    │  Soft Delete       │                    │
     │                    │  UPDATE Message    │                    │
     │                    │  SET isDeleted=    │                    │
     │                    │  true, deletedAt=  │                    │
     │                    │  NOW()             │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Broadcast         │                    │
     │                    │  message:deleted   │                    │
     │                    ├────────────────────────────────────────>│
     │<───────────────────┤                    │                    │
     │                    │                    │                    │
     │ Update UI          │                    │  Update UI         │
     │ Show [deleted]     │                    │  Show [deleted]    │
     │                    │                    │                    │
```

### Database Operations
```sql
-- Soft delete (maintains data for audit trail)
UPDATE "Message"
SET "is_deleted" = true,
    "deleted_at" = NOW(),
    "updated_at" = NOW()
WHERE "id" = $1
  AND "sender_id" = $2
  AND "is_deleted" = false
  AND (NOW() - "created_at") < INTERVAL '5 minutes'
RETURNING *;

-- Optional: Clear content for privacy
-- "content" = '[Message deleted]'
```

### Key Features
- ✅ **Soft delete**: Data retained for audit trail
- ✅ **Time-limited**: 5-minute delete window
- ✅ **Permission-checked**: Only sender can delete
- ✅ **Privacy-aware**: Optional content clearing

---

## 😊 5. Message Reactions Flow

### User Journey
User B reacts with "👍" → User A sees reaction count → User B clicks again to remove

### Sequence Diagram
```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Client B │         │ Socket.IO│         │ Database │         │ Client A │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ message:react      │                    │                    │
     │ (emoji: 👍)        │                    │                    │
     ├───────────────────>│                    │                    │
     │                    │  Check if exists   │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Toggle:           │                    │
     │                    │  If exists → DEL   │                    │
     │                    │  If not → INSERT   │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Get reaction      │                    │
     │                    │  counts (GROUP BY) │                    │
     │                    ├───────────────────>│                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │  Broadcast         │                    │
     │                    │  reaction:added    │                    │
     │                    │  (or removed)      │                    │
     │                    ├────────────────────────────────────────>│
     │<───────────────────┤                    │                    │
     │                    │                    │                    │
     │ Update UI          │                    │  Update UI         │
     │ Show counts        │                    │  Show counts       │
     │                    │                    │                    │
```

### Database Operations
```sql
-- Toggle reaction (upsert/delete pattern)
-- 1. Check if exists
SELECT * FROM "MessageReaction"
WHERE "messageId" = $1 AND "userId" = $2 AND "emoji" = $3;

-- 2. If exists, remove
DELETE FROM "MessageReaction"
WHERE "messageId" = $1 AND "userId" = $2 AND "emoji" = $3;

-- 3. If not exists, add
INSERT INTO "MessageReaction" ("messageId", "userId", "emoji")
VALUES ($1, $2, $3);

-- 4. Get updated counts
SELECT "emoji", COUNT(*) as "count"
FROM "MessageReaction"
WHERE "messageId" = $1
GROUP BY "emoji";
```

### Key Features
- ✅ **Toggle support**: Click to add, click again to remove
- ✅ **Multi-reaction**: User can react with multiple different emojis
- ✅ **Aggregate counts**: Real-time count updates
- ✅ **Unique constraint**: `(messageId, userId, emoji)` prevents duplicates

---

## 📲 6. FCM Push Notifications Flow

### User Journey
User A sends message while User B is offline → User B receives push notification

### Sequence Diagram
```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Client A │  │ Socket.IO│  │  Redis   │  │ Firebase │  │ Client B │
│ (online) │  │          │  │          │  │   FCM    │  │(offline) │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │             │
     │ send-message│             │             │             │
     ├────────────>│             │             │             │
     │             │  Check      │             │             │
     │             │  presence   │             │             │
     │             ├────────────>│             │             │
     │             │<────────────┤             │             │
     │             │  (offline)  │             │             │
     │             │             │             │             │
     │             │  Get FCM    │             │             │
     │             │  tokens     │             │             │
     │             │  (Database) │             │             │
     │             │             │             │             │
     │             │  Send push  │             │             │
     │             │  notification│            │             │
     │             ├─────────────────────────>│             │
     │             │<─────────────────────────┤             │
     │             │             │             │  Push!      │
     │             │             │             ├────────────>│
     │             │             │             │             │
```

### Token Registration
```typescript
// Register FCM token (on app launch)
await fcmNotificationService.registerToken(
  userId,
  fcmToken,
  deviceName // e.g., "iPhone 12", "Chrome on Windows"
);

// Database record
FcmToken {
  id: uuid,
  userId: string,
  token: string (unique),
  deviceName: string,
  isActive: true,
  lastUsedAt: timestamp
}
```

### Multi-Device Support
```typescript
// Get all active tokens for user
const tokens = await prisma.fcmToken.findMany({
  where: {
    userId,
    isActive: true,
  },
});

// Send to all devices
await admin.messaging().sendEachForMulticast({
  notification: { title, body },
  tokens: tokens.map(t => t.token),
});
```

### Invalid Token Cleanup
```typescript
// Handle FCM failures
if (error.code === 'messaging/invalid-registration-token') {
  // Deactivate token
  await prisma.fcmToken.update({
    where: { token },
    data: { isActive: false },
  });
}
```

### Key Features
- ✅ **Presence-aware**: Only send if user is offline
- ✅ **Multi-device**: Send to all active tokens
- ✅ **Auto-cleanup**: Invalid tokens deactivated
- ✅ **Silent data**: Background sync support

---

## ⏰ 7. UptimeRobot Cron Flow

### User Journey
UptimeRobot pings every 5 minutes → Backend executes job every 2 hours → Sends unread reminders

### Sequence Diagram
```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Uptime   │  │ Backend  │  │  Redis   │  │ Database │  │ Firebase │
│  Robot   │  │  Cron    │  │          │  │          │  │   FCM    │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │             │
     │ POST /api/  │             │             │             │
     │ cron/unread │             │             │             │
     │ -reminder   │             │             │             │
     ├────────────>│             │             │             │
     │             │  GET last   │             │             │
     │             │  run time   │             │             │
     │             ├────────────>│             │             │
     │             │<────────────┤             │             │
     │             │             │             │             │
     │             │  Check if   │             │             │
     │             │  2 hours    │             │             │
     │             │  elapsed    │             │             │
     │             │             │             │             │
     │             │  If YES:    │             │             │
     │             │  SET new    │             │             │
     │             │  timestamp  │             │             │
     │             ├────────────>│             │             │
     │             │             │             │             │
     │             │  Find users │             │             │
     │             │  with unread│             │             │
     │             ├─────────────────────────>│             │
     │             │<─────────────────────────┤             │
     │             │             │             │             │
     │             │  Send FCM   │             │             │
     │             │  reminders  │             │             │
     │             ├───────────────────────────────────────>│
     │             │             │             │             │
     │<────────────┤             │             │             │
     │ 200 OK      │             │             │             │
     │             │             │             │             │
```

### Interval Guard Logic
```typescript
const CRON_KEY = 'cron:last-run:unread-reminder';
const TWO_HOURS = 2 * 60 * 60 * 1000;

// Read last run
const lastRun = await redis.get(CRON_KEY);
const now = Date.now();

if (lastRun) {
  const timeSinceLastRun = now - parseInt(lastRun, 10);
  
  if (timeSinceLastRun < TWO_HOURS) {
    // Skip execution
    return res.json({
      success: true,
      skipped: true,
      minutesRemaining: Math.ceil((TWO_HOURS - timeSinceLastRun) / 60000),
    });
  }
}

// Execute job
await redis.set(CRON_KEY, now.toString());
// ... send notifications ...
```

### UptimeRobot Configuration
```
Monitor Name: Chat App Cron - Unread Reminders
Monitor Type: HTTP(S)
URL: https://your-backend.render.com/api/cron/unread-reminder
Method: POST
Interval: 5 minutes
Alert: Email on down status
```

### Key Features
- ✅ **5-min pings**: UptimeRobot pings every 5 minutes
- ✅ **2-hour execution**: Backend enforces 2-hour intervals via Redis
- ✅ **Idempotent**: Safe to call multiple times
- ✅ **No database lock**: Redis-based coordination

---

## 📊 Performance Considerations

### Database Query Optimization
```sql
-- Index for unread message queries
CREATE INDEX idx_messages_unread ON "Message"("receiver_id", "is_read", "created_at")
WHERE "is_deleted" = false;

-- Index for read receipts
CREATE INDEX idx_message_reads_message ON "MessageRead"("messageId");

-- Index for reactions
CREATE INDEX idx_reactions_message ON "MessageReaction"("messageId");
```

### Socket.IO Room Management
```typescript
// Efficient room broadcasting
io.to(`conversation:${conversationId}`).emit('event', data);

// Avoid N+1 queries
const messages = await prisma.message.findMany({
  include: {
    messageReads: {
      include: {
        user: true,
      },
    },
    reactions: {
      include: {
        user: true,
      },
    },
  },
});
```

### Redis Memory Optimization
- **Use TTLs**: Auto-cleanup reduces memory
- **Batch operations**: Use `mget` instead of multiple `get` calls
- **Avoid KEYS in production**: Use SCAN for large keyspaces

---

## 🛠️ Error Handling Patterns

### Socket.IO Event Errors
```typescript
socket.on('message:edit', async (data) => {
  try {
    // ... operation ...
  } catch (error: any) {
    socket.emit('message-error', {
      error: error.message || 'Failed to edit message',
      code: 'EDIT_FAILED',
    });
  }
});
```

### FCM Notification Failures
```typescript
try {
  await fcmNotificationService.sendNotificationIfOffline(...);
} catch (fcmError) {
  // Non-blocking: Log error but don't fail message send
  logger.error('FCM notification failed (non-blocking):', fcmError);
}
```

### Database Transaction Patterns
```typescript
// Atomic reaction toggle
await prisma.$transaction(async (tx) => {
  const existing = await tx.messageReaction.findUnique(...);
  
  if (existing) {
    await tx.messageReaction.delete(...);
  } else {
    await tx.messageReaction.create(...);
  }
});
```

---

## 📚 Related Documentation
- [Redis Key Design](./REDIS_KEYS.md)
- [API Reference](./API.md)
- [Architecture Overview](../ARCHITECTURE.md)
