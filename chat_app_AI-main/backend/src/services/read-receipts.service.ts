/**
 * READ RECEIPTS SERVICE
 * =====================
 * Handles per-user read receipts for messages
 * - Group chat ready (multiple users can mark as read)
 * - Idempotent (unique constraint on messageId + userId)
 * - Real-time broadcast via Socket.IO
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class ReadReceiptsService {
  /**
   * Mark a message as read by a user
   * @param messageId - The message ID to mark as read
   * @param userId - The user ID who read the message
   * @returns The created MessageRead record (or existing if duplicate)
   */
  async markMessageAsRead(messageId: string, userId: string) {
    try {
      // Idempotent upsert - won't fail if already exists
      const messageRead = await prisma.messageRead.upsert({
        where: {
          unique_message_user_read: {
            messageId,
            userId,
          },
        },
        update: {
          readAt: new Date(), // Update timestamp if re-read
        },
        create: {
          messageId,
          userId,
          readAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              clerkId: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      logger.info('Message marked as read', {
        messageId,
        userId,
        readAt: messageRead.readAt,
      });

      return messageRead;
    } catch (error) {
      logger.error('Failed to mark message as read', {
        messageId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to mark message as read');
    }
  }

  /**
   * Get all read receipts for a message
   * @param messageId - The message ID to fetch receipts for
   * @returns Array of users who read the message with timestamps
   */
  async getMessageReadReceipts(messageId: string) {
    try {
      const receipts = await prisma.messageRead.findMany({
        where: { messageId },
        include: {
          user: {
            select: {
              id: true,
              clerkId: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          readAt: 'asc',
        },
      });

      return receipts.map((receipt) => ({
        userId: receipt.userId,
        username: receipt.user.username,
        firstName: receipt.user.firstName,
        lastName: receipt.user.lastName,
        readAt: receipt.readAt,
      }));
    } catch (error) {
      logger.error('Failed to fetch read receipts', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to fetch read receipts');
    }
  }

  /**
   * Get read status for multiple messages (batch query)
   * @param messageIds - Array of message IDs
   * @param userId - The user ID to check read status for (optional)
   * @returns Map of messageId → read count (or boolean if userId provided)
   */
  async getBatchReadStatus(messageIds: string[], userId?: string) {
    try {
      if (userId) {
        // Check if specific user read these messages
        const reads = await prisma.messageRead.findMany({
          where: {
            messageId: { in: messageIds },
            userId,
          },
          select: { messageId: true },
        });

        const readMap = new Map<string, boolean>();
        const readSet = new Set(reads.map((r) => r.messageId));

        messageIds.forEach((id) => {
          readMap.set(id, readSet.has(id));
        });

        return readMap;
      } else {
        // Get read count for each message
        const reads = await prisma.messageRead.groupBy({
          by: ['messageId'],
          where: {
            messageId: { in: messageIds },
          },
          _count: {
            userId: true,
          },
        });

        const countMap = new Map<string, number>();
        reads.forEach((read) => {
          countMap.set(read.messageId, read._count.userId);
        });

        // Fill in zeros for messages with no reads
        messageIds.forEach((id) => {
          if (!countMap.has(id)) {
            countMap.set(id, 0);
          }
        });

        return countMap;
      }
    } catch (error) {
      logger.error('Failed to fetch batch read status', {
        messageIds: messageIds.length,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to fetch batch read status');
    }
  }

  /**
   * Check if a message has been read by ALL participants in a conversation
   * @param messageId - The message ID to check
   * @param conversationId - The conversation ID (to count expected readers)
   * @returns Boolean indicating if all participants have read
   */
  async hasAllRead(messageId: string, conversationId: string) {
    try {
      // Get the message to find sender
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { senderId: true },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Get conversation participants (exclude sender)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Get other participants (exclude sender)
      const participantIds = [conversation.user1Id, conversation.user2Id].filter(
        (id) => id !== message.senderId
      );
      const expectedReaders = participantIds.length;

      // Count actual reads
      const actualReads = await prisma.messageRead.count({
        where: {
          messageId,
          userId: {
            in: participantIds,
          },
        },
      });

      return actualReads === expectedReaders;
    } catch (error) {
      logger.error('Failed to check if all read', {
        messageId,
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export const readReceiptsService = new ReadReceiptsService();
