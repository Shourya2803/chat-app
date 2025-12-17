import * as admin from 'firebase-admin';
import { config } from '../config';
import { logger } from '../utils/logger';
import { query } from '../database/client';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      privateKey: config.firebase.privateKey,
      clientEmail: config.firebase.clientEmail,
    }),
  });
}

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class NotificationService {
  async sendToUser(payload: NotificationPayload): Promise<void> {
    try {
      // Get user's FCM tokens
      const result = await query(
        'SELECT token FROM fcm_tokens WHERE user_id = $1',
        [payload.userId]
      );

      if (result.rows.length === 0) {
        logger.warn('No FCM tokens found for user', { userId: payload.userId });
        return;
      }

      const tokens = result.rows.map(row => row.token);

      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      logger.info('Notifications sent', {
        userId: payload.userId,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      // Remove invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });

        await this.removeInvalidTokens(payload.userId, failedTokens);
      }
    } catch (error) {
      logger.error('Failed to send notification', { error, payload });
    }
  }

  async sendMessageNotification(
    recipientId: string,
    senderName: string,
    conversationId: string
  ): Promise<void> {
    await this.sendToUser({
      userId: recipientId,
      title: 'New Message',
      body: `${senderName} sent you a message`,
      data: {
        type: 'message',
        conversationId,
        senderId: senderName,
      },
    });
  }

  async registerToken(userId: string, token: string, deviceType: string = 'web'): Promise<void> {
    try {
      await query(
        `INSERT INTO fcm_tokens (user_id, token, device_type, updated_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, token) 
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP, device_type = $3`,
        [userId, token, deviceType]
      );

      logger.info('FCM token registered', { userId, deviceType });
    } catch (error) {
      logger.error('Failed to register FCM token', { error, userId });
      throw error;
    }
  }

  async removeToken(userId: string, token: string): Promise<void> {
    try {
      await query(
        'DELETE FROM fcm_tokens WHERE user_id = $1 AND token = $2',
        [userId, token]
      );

      logger.info('FCM token removed', { userId });
    } catch (error) {
      logger.error('Failed to remove FCM token', { error, userId });
    }
  }

  private async removeInvalidTokens(userId: string, tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    try {
      await query(
        'DELETE FROM fcm_tokens WHERE user_id = $1 AND token = ANY($2)',
        [userId, tokens]
      );

      logger.info('Invalid tokens removed', { userId, count: tokens.length });
    } catch (error) {
      logger.error('Failed to remove invalid tokens', { error, userId });
    }
  }
}

export const notificationService = new NotificationService();
