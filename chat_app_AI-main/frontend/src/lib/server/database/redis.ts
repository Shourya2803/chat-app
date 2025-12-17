import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Check if Redis URL is provided (for cloud Redis like Upstash)
const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl 
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    })
  : new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null,
      lazyConnect: true, // Don't connect immediately if not available
    });

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
  // Don't crash the app if Redis is not available
});

// Presence management
export const presenceService = {
  async setOnline(userId: string): Promise<void> {
    await redis.setex(`presence:${userId}`, 300, 'online'); // 5 min TTL
    await redis.publish('presence', JSON.stringify({ userId, status: 'online' }));
  },

  async setOffline(userId: string): Promise<void> {
    await redis.del(`presence:${userId}`);
    await redis.publish('presence', JSON.stringify({ userId, status: 'offline' }));
  },

  async getStatus(userId: string): Promise<string> {
    const status = await redis.get(`presence:${userId}`);
    return status || 'offline';
  },

  async getBulkStatus(userIds: string[]): Promise<Record<string, string>> {
    const pipeline = redis.pipeline();
    userIds.forEach(id => pipeline.get(`presence:${id}`));
    const results = await pipeline.exec();
    
    const statusMap: Record<string, string> = {};
    userIds.forEach((id, index) => {
      const [err, value] = results![index];
      statusMap[id] = (value as string) || 'offline';
    });
    return statusMap;
  },

  async heartbeat(userId: string): Promise<void> {
    await redis.expire(`presence:${userId}`, 300);
  },
};

// Typing indicator
export const typingService = {
  async setTyping(conversationId: string, userId: string): Promise<void> {
    await redis.setex(`typing:${conversationId}:${userId}`, 5, '1');
    await redis.publish(
      `typing:${conversationId}`,
      JSON.stringify({ userId, isTyping: true })
    );
  },

  async stopTyping(conversationId: string, userId: string): Promise<void> {
    await redis.del(`typing:${conversationId}:${userId}`);
    await redis.publish(
      `typing:${conversationId}`,
      JSON.stringify({ userId, isTyping: false })
    );
  },

  async getTypingUsers(conversationId: string): Promise<string[]> {
    const keys = await redis.keys(`typing:${conversationId}:*`);
    return keys.map(key => key.split(':')[2]);
  },
};

// Caching
export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, data);
    } else {
      await redis.set(key, data);
    }
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};

// Unread message counters
export const unreadService = {
  async increment(userId: string, conversationId: string): Promise<void> {
    await redis.hincrby(`unread:${userId}`, conversationId, 1);
  },

  async reset(userId: string, conversationId: string): Promise<void> {
    await redis.hdel(`unread:${userId}`, conversationId);
  },

  async getCount(userId: string, conversationId: string): Promise<number> {
    const count = await redis.hget(`unread:${userId}`, conversationId);
    return count ? parseInt(count, 10) : 0;
  },

  async getAllCounts(userId: string): Promise<Record<string, number>> {
    const counts = await redis.hgetall(`unread:${userId}`);
    const result: Record<string, number> = {};
    for (const [conversationId, count] of Object.entries(counts)) {
      result[conversationId] = parseInt(count, 10);
    }
    return result;
  },
};
