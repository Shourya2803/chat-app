/**
 * CRON JOB ROUTES
 * ================
 * Endpoints for scheduled tasks triggered by UptimeRobot
 * - 5-minute pings from UptimeRobot
 * - 2-hour execution interval enforced via Redis
 * - Unread message reminders
 * - Token cleanup
 */

import { Router, Request, Response } from 'express';
import { redis } from '../lib/redis';
import { fcmNotificationService } from '../services/fcm.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const CRON_LAST_RUN_KEY = 'cron:last-run:unread-reminder';

/**
 * Unread Message Reminder Cron
 * =============================
 * Triggered every 5 minutes by UptimeRobot, but executes only every 2 hours
 * Sends push notifications to users with unread messages
 */
router.post('/unread-reminder', async (req: Request, res: Response) => {
  try {
    logger.info('Unread reminder cron triggered');

    // Check last run timestamp from Redis
    const lastRunTimestamp = await redis.get(CRON_LAST_RUN_KEY);
    const now = Date.now();

    if (lastRunTimestamp) {
      const lastRun = parseInt(lastRunTimestamp, 10);
      const timeSinceLastRun = now - lastRun;

      if (timeSinceLastRun < TWO_HOURS_IN_MS) {
        const minutesRemaining = Math.ceil(
          (TWO_HOURS_IN_MS - timeSinceLastRun) / 60000
        );

        logger.info('Skipping cron execution (within 2-hour interval)', {
          timeSinceLastRun: Math.floor(timeSinceLastRun / 60000),
          minutesRemaining,
        });

        return res.status(200).json({
          success: true,
          skipped: true,
          message: `Last run was ${Math.floor(timeSinceLastRun / 60000)} minutes ago. Next run in ${minutesRemaining} minutes.`,
        });
      }
    }

    // Execute the cron job
    logger.info('Executing unread reminder cron job');

    // Update last run timestamp
    await redis.set(CRON_LAST_RUN_KEY, now.toString());

    // Find users with unread messages (not delivered via push)
    const usersWithUnread = await prisma.message.findMany({
      where: {
        isRead: false,
        isDeleted: false,
        // Messages older than 1 hour but newer than 24 hours
        createdAt: {
          gte: new Date(now - 24 * 60 * 60 * 1000), // 24 hours ago
          lte: new Date(now - 60 * 60 * 1000), // 1 hour ago
        },
      },
      distinct: ['receiverId'],
      select: {
        receiverId: true,
        receiver: {
          select: {
            id: true,
            clerkId: true,
            username: true,
            firstName: true,
          },
        },
      },
    });

    logger.info('Users with unread messages', {
      count: usersWithUnread.length,
    });

    // Send notifications to each user
    let notificationsSent = 0;
    let notificationsFailed = 0;

    for (const item of usersWithUnread) {
      try {
        const receiverId = item.receiverId;
        const receiver = item.receiver;

        // Count unread messages for this user
        const unreadCount = await prisma.message.count({
          where: {
            receiverId: receiverId,
            isRead: false,
            isDeleted: false,
          },
        });

        if (unreadCount === 0) {
          continue;
        }

        // Send FCM notification
        await fcmNotificationService.sendNotificationIfOffline(
          receiverId,
          {
            title: 'Unread Messages',
            body: `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''} waiting for you!`,
          },
          {
            type: 'unread-reminder',
            unreadCount: unreadCount.toString(),
            timestamp: now.toString(),
          }
        );

        notificationsSent++;

        logger.info('Unread reminder sent', {
          userId: receiverId,
          username: receiver.username,
          unreadCount,
        });
      } catch (error) {
        notificationsFailed++;
        logger.error('Failed to send unread reminder', {
          userId: item.receiverId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Unread reminder cron job completed', {
      usersProcessed: usersWithUnread.length,
      notificationsSent,
      notificationsFailed,
    });

    res.status(200).json({
      success: true,
      skipped: false,
      usersProcessed: usersWithUnread.length,
      notificationsSent,
      notificationsFailed,
      nextRunAt: new Date(now + TWO_HOURS_IN_MS).toISOString(),
    });
  } catch (error) {
    logger.error('Unread reminder cron job failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Token Cleanup Cron
 * ===================
 * Cleans up expired FCM tokens (30+ days old)
 * Can run more frequently (e.g., daily)
 */
router.post('/cleanup-tokens', async (req: Request, res: Response) => {
  try {
    logger.info('Token cleanup cron triggered');

    // Check last run timestamp
    const lastRunKey = 'cron:last-run:cleanup-tokens';
    const lastRunTimestamp = await redis.get(lastRunKey);
    const now = Date.now();
    const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

    if (lastRunTimestamp) {
      const lastRun = parseInt(lastRunTimestamp, 10);
      const timeSinceLastRun = now - lastRun;

      if (timeSinceLastRun < ONE_DAY_IN_MS) {
        const hoursRemaining = Math.ceil(
          (ONE_DAY_IN_MS - timeSinceLastRun) / 3600000
        );

        logger.info('Skipping token cleanup (within 24-hour interval)', {
          timeSinceLastRun: Math.floor(timeSinceLastRun / 3600000),
          hoursRemaining,
        });

        return res.status(200).json({
          success: true,
          skipped: true,
          message: `Last run was ${Math.floor(timeSinceLastRun / 3600000)} hours ago. Next run in ${hoursRemaining} hours.`,
        });
      }
    }

    // Execute cleanup
    await redis.set(lastRunKey, now.toString());
    await fcmNotificationService.cleanupExpiredTokens();

    logger.info('Token cleanup cron job completed');

    res.status(200).json({
      success: true,
      skipped: false,
      message: 'Token cleanup completed successfully',
      nextRunAt: new Date(now + ONE_DAY_IN_MS).toISOString(),
    });
  } catch (error) {
    logger.error('Token cleanup cron job failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Health Check for UptimeRobot
 * =============================
 * Simple endpoint to verify cron system is responsive
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    service: 'cron-jobs',
  });
});

export default router;
