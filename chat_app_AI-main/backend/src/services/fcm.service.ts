/**
 * FIREBASE CLOUD MESSAGING (FCM) SERVICE
 * =======================================
 * Handles push notifications for offline users
 * - Multi-device support (sends to all active tokens)
 * - Invalid token cleanup (auto-deactivate)
 * - Silent data messages for background sync
 * - Presence-aware (only send if user is offline)
 */

import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { presenceService } from '../lib/redis';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return;
  }

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!serviceAccount || !projectId) {
      logger.warn(
        'Firebase credentials not found. FCM notifications will be disabled.'
      );
      return;
    }

    // Parse service account JSON
    const serviceAccountParsed = JSON.parse(serviceAccount);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountParsed),
      projectId: projectId,
    });

    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Initialize on module load
initializeFirebase();

export class FcmNotificationService {
  /**
   * Send a push notification to a user (only if offline)
   * @param userId - The target user ID
   * @param notification - Notification payload
   * @param data - Optional data payload (for background sync)
   */
  async sendNotificationIfOffline(
    userId: string,
    notification: {
      title: string;
      body: string;
      imageUrl?: string;
    },
    data?: Record<string, string>
  ): Promise<void> {
    if (!firebaseInitialized) {
      logger.warn('Firebase not initialized. Skipping notification.');
      return;
    }

    try {
      // Check if user is online via Redis presence
      const status = await presenceService.getStatus(userId);

      if (status === 'online') {
        logger.debug('User is online. Skipping push notification.', { userId });
        return;
      }

      // Get all active FCM tokens for the user
      const tokens = await prisma.fcmToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          token: true,
          deviceName: true,
        },
      });

      if (tokens.length === 0) {
        logger.info('No active FCM tokens found for user', { userId });
        return;
      }

      const tokenStrings = tokens.map((t) => t.token);

      // Send multicast message to all devices
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: data || {},
        tokens: tokenStrings,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      logger.info('FCM notifications sent', {
        userId,
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalTokens: tokenStrings.length,
      });

      // Handle failed tokens (cleanup invalid ones)
      if (response.failureCount > 0) {
        await this.handleFailedTokens(userId, tokenStrings, response.responses);
      }
    } catch (error) {
      logger.error('Failed to send FCM notification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send silent data message (for background sync)
   * @param userId - The target user ID
   * @param data - Data payload
   */
  async sendSilentDataMessage(
    userId: string,
    data: Record<string, string>
  ): Promise<void> {
    if (!firebaseInitialized) {
      logger.warn('Firebase not initialized. Skipping data message.');
      return;
    }

    try {
      // Check if user is online
      const status = await presenceService.getStatus(userId);

      if (status === 'online') {
        logger.debug('User is online. Skipping silent data message.', {
          userId,
        });
        return;
      }

      // Get all active FCM tokens
      const tokens = await prisma.fcmToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          token: true,
        },
      });

      if (tokens.length === 0) {
        return;
      }

      const tokenStrings = tokens.map((t) => t.token);

      // Silent message (data only, no notification)
      const message: admin.messaging.MulticastMessage = {
        data: data,
        tokens: tokenStrings,
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
          headers: {
            'apns-push-type': 'background',
            'apns-priority': '5',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      logger.info('Silent data messages sent', {
        userId,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      if (response.failureCount > 0) {
        await this.handleFailedTokens(userId, tokenStrings, response.responses);
      }
    } catch (error) {
      logger.error('Failed to send silent data message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Register an FCM token for a user
   * @param userId - The user ID
   * @param token - The FCM registration token
   * @param deviceName - Optional device name/identifier
   */
  async registerToken(
    userId: string,
    token: string,
    deviceName?: string
  ): Promise<void> {
    try {
      await prisma.fcmToken.upsert({
        where: {
          token: token,
        },
        update: {
          isActive: true,
          deviceName: deviceName || null,
          lastUsedAt: new Date(),
        },
        create: {
          userId,
          token,
          deviceName: deviceName || null,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });

      logger.info('FCM token registered', { userId, deviceName });
    } catch (error) {
      logger.error('Failed to register FCM token', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Deactivate an FCM token
   * @param token - The FCM token to deactivate
   */
  async deactivateToken(token: string): Promise<void> {
    try {
      await prisma.fcmToken.update({
        where: { token },
        data: {
          isActive: false,
        },
      });

      logger.info('FCM token deactivated', { token: token.substring(0, 20) });
    } catch (error) {
      logger.error('Failed to deactivate FCM token', {
        token: token.substring(0, 20),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle failed tokens (deactivate invalid ones)
   * @param userId - The user ID
   * @param tokens - Array of tokens sent to
   * @param responses - Array of send responses from FCM
   */
  private async handleFailedTokens(
    userId: string,
    tokens: string[],
    responses: admin.messaging.SendResponse[]
  ): Promise<void> {
    const tokensToDeactivate: string[] = [];

    responses.forEach((response, index) => {
      if (!response.success) {
        const error = response.error;

        // Check for invalid token errors
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered' ||
          error?.code === 'messaging/invalid-argument'
        ) {
          tokensToDeactivate.push(tokens[index]);
          logger.warn('Invalid FCM token detected', {
            userId,
            errorCode: error.code,
            tokenPreview: tokens[index].substring(0, 20),
          });
        }
      }
    });

    // Deactivate invalid tokens
    if (tokensToDeactivate.length > 0) {
      await prisma.fcmToken.updateMany({
        where: {
          token: {
            in: tokensToDeactivate,
          },
        },
        data: {
          isActive: false,
        },
      });

      logger.info('Invalid FCM tokens deactivated', {
        userId,
        count: tokensToDeactivate.length,
      });
    }
  }

  /**
   * Cleanup expired tokens (tokens not used in 30+ days)
   * Call this periodically via cron job
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.fcmToken.deleteMany({
        where: {
          lastUsedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      logger.info('Expired FCM tokens cleaned up', {
        deletedCount: result.count,
      });
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all active tokens for a user
   * @param userId - The user ID
   * @returns Array of active FCM tokens
   */
  async getActiveTokens(userId: string) {
    try {
      const tokens = await prisma.fcmToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          token: true,
          deviceName: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: {
          lastUsedAt: 'desc',
        },
      });

      return tokens;
    } catch (error) {
      logger.error('Failed to get active tokens', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}

export const fcmNotificationService = new FcmNotificationService();
