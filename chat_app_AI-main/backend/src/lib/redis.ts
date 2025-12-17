/**
 * Redis Client for Backend
 * =========================
 * This module provides Redis connectivity for:
 * - User presence tracking (online/offline status)
 * - Real-time status updates
 * - Cache management
 * 
 * Used only on the backend server (Render).
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Check if Redis URL is provided (for cloud Redis like Upstash/Railway)
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
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null,
      lazyConnect: true, // Don't crash if Redis is unavailable
    });

redis.on('connect', () => {
  logger.info('✅ Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
  // Don't crash the app if Redis is not available
});

// ========================================
// PRESENCE SERVICE
// ========================================

export const presenceService = {
  /**
   * Mark user as online with 5-minute TTL
   */
  async setOnline(userId: string): Promise<void> {
    try {
      await redis.setex(`presence:${userId}`, 300, 'online'); // 5 min TTL
      await redis.publish('presence', JSON.stringify({ userId, status: 'online' }));
    } catch (error) {
      logger.error('Failed to set user online:', error);
    }
  },

  /**
   * Mark user as offline
   */
  async setOffline(userId: string): Promise<void> {
    try {
      await redis.del(`presence:${userId}`);
      await redis.publish('presence', JSON.stringify({ userId, status: 'offline' }));
    } catch (error) {
      logger.error('Failed to set user offline:', error);
    }
  },

  /**
   * Get user online status
   */
  async getStatus(userId: string): Promise<string> {
    try {
      const status = await redis.get(`presence:${userId}`);
      return status || 'offline';
    } catch (error) {
      logger.error('Failed to get user status:', error);
      return 'offline';
    }
  },

  /**
   * Get multiple users' online status
   */
  async getBatchStatus(userIds: string[]): Promise<Record<string, string>> {
    try {
      const pipeline = redis.pipeline();
      userIds.forEach(id => pipeline.get(`presence:${id}`));
      const results = await pipeline.exec();
      
      const statuses: Record<string, string> = {};
      userIds.forEach((id, index) => {
        const result = results?.[index];
        statuses[id] = (result && result[1]) ? 'online' : 'offline';
      });
      
      return statuses;
    } catch (error) {
      logger.error('Failed to get batch status:', error);
      return {};
    }
  },
};

export default redis;
