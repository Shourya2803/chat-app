/**
 * TYPING INDICATORS SERVICE
 * =========================
 * Redis-based typing indicators with auto-expiration
 * - TTL-based (3 seconds default)
 * - Throttled to prevent spam
 * - No database writes (ephemeral state)
 */

import { redis } from '../lib/redis';
import { logger } from '../utils/logger';

const TYPING_TTL = 3; // seconds
const TYPING_THROTTLE = 2000; // milliseconds (max 1 event per 2 seconds)

export class TypingIndicatorsService {
  private throttleMap = new Map<string, number>(); // userId:conversationId → last event timestamp

  /**
   * Set a user as typing in a conversation
   * @param conversationId - The conversation ID
   * @param userId - The user ID who is typing
   * @param username - The username (for broadcast payload)
   * @returns Boolean indicating if the event was processed (not throttled)
   */
  async setTyping(
    conversationId: string,
    userId: string,
    username: string | null
  ): Promise<boolean> {
    const throttleKey = `${userId}:${conversationId}`;
    const now = Date.now();
    const lastEvent = this.throttleMap.get(throttleKey) || 0;

    // Throttle check
    if (now - lastEvent < TYPING_THROTTLE) {
      logger.debug('Typing event throttled', { userId, conversationId });
      return false;
    }

    try {
      const key = `typing:${conversationId}:${userId}`;
      const value = JSON.stringify({
        userId,
        username,
        timestamp: now,
      });

      // Set with TTL (will auto-expire after TYPING_TTL seconds)
      await redis.setex(key, TYPING_TTL, value);

      // Update throttle map
      this.throttleMap.set(throttleKey, now);

      logger.debug('User typing indicator set', {
        userId,
        conversationId,
        ttl: TYPING_TTL,
      });

      return true;
    } catch (error) {
      logger.error('Failed to set typing indicator', {
        userId,
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Stop typing indicator for a user
   * @param conversationId - The conversation ID
   * @param userId - The user ID who stopped typing
   */
  async stopTyping(conversationId: string, userId: string): Promise<void> {
    try {
      const key = `typing:${conversationId}:${userId}`;
      await redis.del(key);

      // Clear throttle
      const throttleKey = `${userId}:${conversationId}`;
      this.throttleMap.delete(throttleKey);

      logger.debug('User typing indicator stopped', { userId, conversationId });
    } catch (error) {
      logger.error('Failed to stop typing indicator', {
        userId,
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all users currently typing in a conversation
   * @param conversationId - The conversation ID
   * @returns Array of users who are typing
   */
  async getTypingUsers(conversationId: string): Promise<
    Array<{
      userId: string;
      username: string | null;
      timestamp: number;
    }>
  > {
    try {
      const pattern = `typing:${conversationId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return [];
      }

      const values = await redis.mget(...keys);
      const typingUsers: Array<{
        userId: string;
        username: string | null;
        timestamp: number;
      }> = [];

      values.forEach((value) => {
        if (value) {
          try {
            const parsed = JSON.parse(value);
            typingUsers.push(parsed);
          } catch (parseError) {
            logger.error('Failed to parse typing indicator value', {
              value,
              error:
                parseError instanceof Error
                  ? parseError.message
                  : 'Unknown error',
            });
          }
        }
      });

      return typingUsers;
    } catch (error) {
      logger.error('Failed to get typing users', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Check if a specific user is typing in a conversation
   * @param conversationId - The conversation ID
   * @param userId - The user ID to check
   * @returns Boolean indicating if user is typing
   */
  async isUserTyping(conversationId: string, userId: string): Promise<boolean> {
    try {
      const key = `typing:${conversationId}:${userId}`;
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check if user is typing', {
        userId,
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Clean up stale throttle entries (call periodically)
   * Removes throttle entries older than 5 minutes
   */
  cleanupThrottleMap(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (const [key, timestamp] of this.throttleMap.entries()) {
      if (now - timestamp > STALE_THRESHOLD) {
        this.throttleMap.delete(key);
      }
    }

    logger.debug('Throttle map cleaned up', {
      remainingEntries: this.throttleMap.size,
    });
  }
}

export const typingIndicatorsService = new TypingIndicatorsService();

// Clean up throttle map every 5 minutes
setInterval(() => {
  typingIndicatorsService.cleanupThrottleMap();
}, 5 * 60 * 1000);
