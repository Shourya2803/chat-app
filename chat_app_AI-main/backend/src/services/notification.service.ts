/**
 * NOTIFICATION SERVICE
 * ====================
 * Handles in-app notifications, FCM push, and email notifications
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { fcmNotificationService } from './fcm.service';
import { emailService } from './email.service';

const prisma = new PrismaClient();

export type NotificationType = 'message' | 'reaction' | 'mention' | 'system';

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  sendPush?: boolean;
  sendEmail?: boolean;
}

export class NotificationService {
  /**
   * Create a notification (in-app + optional FCM + optional email)
   */
  async createNotification(data: CreateNotificationData) {
    try {
      // 1. Create in-app notification
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          actionUrl: data.actionUrl,
          metadata: data.metadata as any,
        },
      });

      logger.info(`✅ Notification created for user ${data.userId}`);

      // 2. Send push notification if enabled
      if (data.sendPush !== false) {
        await fcmNotificationService.sendNotificationIfOffline(
          data.userId,
          {
            title: data.title,
            body: data.body,
          },
          {
            type: data.type,
            actionUrl: data.actionUrl || '',
          }
        );
      }

      // 3. Send email notification if enabled
      if (data.sendEmail) {
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { email: true, username: true, firstName: true },
        });

        if (user?.email) {
          await emailService.sendNotificationEmail({
            to: user.email,
            userName: user.username || user.firstName || 'User',
            title: data.title,
            body: data.body,
            actionUrl: data.actionUrl,
          });
        }
      }

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Get user's unread notifications
   */
  async getUnreadNotifications(userId: string, limit: number = 50) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          isRead: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return notifications;
    } catch (error) {
      logger.error('Failed to fetch unread notifications:', error);
      return [];
    }
  }

  /**
   * Get all user notifications (with pagination)
   */
  async getAllNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    try {
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      return {
        notifications,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      logger.error('Failed to fetch notifications:', error);
      return { notifications: [], total: 0, hasMore: false };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId, // Security: only update own notifications
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info(`✅ Marked ${result.count} notifications as read for user ${userId}`);
      return result.count;
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      await prisma.notification.deleteMany({
        where: {
          id: notificationId,
          userId, // Security: only delete own notifications
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      return false;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return count;
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      return 0;
    }
  }
}

export const notificationService = new NotificationService();
