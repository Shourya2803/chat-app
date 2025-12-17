# REDIS KEY DESIGN
## Redis Key Patterns and TTL Configuration

This document outlines all Redis keys used in the chat application, their purposes, TTL configurations, and usage patterns.

---

## 📌 Key Patterns Overview

| Pattern | Purpose | TTL | Example |
|---------|---------|-----|---------|
| `presence:${userId}` | User online/offline status | 5 minutes | `presence:user-123` |
| `typing:${conversationId}:${userId}` | Typing indicator state | 3 seconds | `typing:conv-456:user-123` |
| `cron:last-run:${jobName}` | Cron job execution timestamps | No TTL | `cron:last-run:unread-reminder` |

---

## 1. Presence Management

### Key Pattern
```
presence:${userId}
```

### Purpose
Track user online/offline status for real-time presence indicators and FCM notification decisions.

### TTL
**5 minutes** (300 seconds)

### Value Format
```json
{
  "userId": "user-123",
  "status": "online",
  "lastSeen": 1704067200000
}
```

### Usage Pattern
- **Set**: When user connects via Socket.IO or sends heartbeat
- **Check**: Before sending FCM notifications (skip if online)
- **Auto-expire**: Redis TTL automatically removes key after 5 minutes of inactivity

### Example Operations
```typescript
// Set user online
await redis.setex(
  `presence:${userId}`,
  300,
  JSON.stringify({ userId, status: 'online', lastSeen: Date.now() })
);

// Check status
const data = await redis.get(`presence:${userId}`);
const status = data ? 'online' : 'offline';

// Manual cleanup (on disconnect)
await redis.del(`presence:${userId}`);
```

---

## 2. Typing Indicators

### Key Pattern
```
typing:${conversationId}:${userId}
```

### Purpose
Ephemeral state for "User is typing..." indicators with auto-expiration.

### TTL
**3 seconds**

### Value Format
```json
{
  "userId": "user-123",
  "username": "john_doe",
  "timestamp": 1704067200000
}
```

### Usage Pattern
- **Set**: When user emits `typing:start` event (throttled to max 1 per 2 seconds)
- **Delete**: When user emits `typing:stop` event
- **Auto-expire**: Redis TTL automatically removes typing state after 3 seconds

### Throttling Logic
To prevent spam, typing events are throttled:
- Max 1 event per 2 seconds per user per conversation
- Throttle state stored in-memory (Map)
- Throttle map cleanup every 5 minutes

### Example Operations
```typescript
// Start typing
await redis.setex(
  `typing:${conversationId}:${userId}`,
  3,
  JSON.stringify({ userId, username, timestamp: Date.now() })
);

// Stop typing
await redis.del(`typing:${conversationId}:${userId}`);

// Get all typing users in a conversation
const keys = await redis.keys(`typing:${conversationId}:*`);
const values = await redis.mget(...keys);
// Parse values to get array of typing users
```

---

## 3. Cron Job Timestamps

### Key Pattern
```
cron:last-run:${jobName}
```

### Purpose
Track last execution timestamp for cron jobs to enforce minimum intervals (e.g., 2 hours for unread reminders).

### TTL
**No TTL** (persistent)

### Value Format
```
"1704067200000"
```
(Unix timestamp as string)

### Available Job Names
- `unread-reminder` - Unread message notification cron (2-hour interval)
- `cleanup-tokens` - FCM token cleanup cron (24-hour interval)

### Usage Pattern
1. **Read** last run timestamp
2. **Compare** with current time
3. **Skip** if within interval window
4. **Update** timestamp after execution

### Example Operations
```typescript
const CRON_KEY = 'cron:last-run:unread-reminder';
const TWO_HOURS = 2 * 60 * 60 * 1000;

// Check last run
const lastRun = await redis.get(CRON_KEY);
const now = Date.now();

if (lastRun) {
  const timeSinceLastRun = now - parseInt(lastRun, 10);
  if (timeSinceLastRun < TWO_HOURS) {
    // Skip execution
    return;
  }
}

// Execute job...

// Update last run
await redis.set(CRON_KEY, now.toString());
```

---

## 🔒 Key Naming Conventions

### 1. **Use colons (`:`) as separators**
```
✅ presence:user-123
❌ presence_user_123
```

### 2. **Entity-first hierarchy**
```
presence:${userId}           // User presence
typing:${convId}:${userId}   // Typing state
cron:last-run:${jobName}     // Cron timestamps
```

### 3. **Use descriptive prefixes**
- `presence:` - User online/offline state
- `typing:` - Ephemeral typing indicators
- `cron:` - Background job metadata

---

## 📊 Memory Management

### Expected Memory Usage (per 1000 users)

| Key Type | Count | Size per Key | Total |
|----------|-------|--------------|-------|
| Presence | ~1000 | ~80 bytes | ~80 KB |
| Typing | ~10-50 | ~100 bytes | ~5 KB |
| Cron | ~2-5 | ~30 bytes | ~150 bytes |

**Total estimated**: ~85 KB per 1000 active users

### TTL Benefits
- **Auto-cleanup**: Keys expire automatically (no manual cleanup needed)
- **Memory efficiency**: Stale data removed by Redis
- **Performance**: No database writes for ephemeral state

---

## 🛠️ Redis Configuration Recommendations

### redis.conf Settings
```conf
# Enable persistence (optional, for cron timestamps)
save 900 1
save 300 10
save 60 10000

# Max memory policy (evict least recently used)
maxmemory 256mb
maxmemory-policy allkeys-lru

# Enable keyspace notifications (for monitoring)
notify-keyspace-events Ex
```

### Connection Pool
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});
```

---

## 🔍 Monitoring & Debugging

### Check Active Keys
```bash
# Count presence keys
redis-cli KEYS "presence:*" | wc -l

# Count typing keys
redis-cli KEYS "typing:*" | wc -l

# View all cron timestamps
redis-cli KEYS "cron:*"
```

### Inspect Key TTL
```bash
# Check remaining TTL for a key
redis-cli TTL presence:user-123

# Output:
# 287 (seconds remaining)
# -1 (no TTL)
# -2 (key doesn't exist)
```

### Monitor Real-time Operations
```bash
# Watch all Redis commands in real-time
redis-cli MONITOR

# Output example:
# 1704067200.123 [0] "SETEX" "presence:user-123" "300" "{...}"
# 1704067201.456 "GET" "presence:user-123"
```

---

## 🚨 Common Issues & Solutions

### Issue: Typing indicators not clearing
**Cause**: Client disconnects without emitting `typing:stop`  
**Solution**: Auto-expiration via 3-second TTL handles this automatically

### Issue: User shows as "online" after disconnect
**Cause**: Heartbeat continues even after socket disconnect  
**Solution**: Emit heartbeat stop on disconnect event

### Issue: Cron job runs too frequently
**Cause**: Redis key not persisting across server restarts  
**Solution**: Enable Redis persistence (RDB/AOF) or use PostgreSQL for cron timestamps

---

## 📚 Related Documentation
- [Architecture Overview](../ARCHITECTURE.md)
- [Data Flows](./DATA_FLOWS.md)
- [Backend Deployment Guide](./DEPLOYMENT.md)
