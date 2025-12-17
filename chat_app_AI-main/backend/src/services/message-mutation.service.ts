/**
 * MESSAGE MUTATION SERVICE
 * =========================
 * Handles message edit and delete operations
 * - Time-window enforcement (5 minutes default)
 * - Permission validation (sender only)
 * - Soft delete (maintains data integrity)
 * - Audit trail with timestamps
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const EDIT_TIME_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds
const DELETE_TIME_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

export class MessageMutationService {
  /**
   * Edit a message (within time window)
   * @param messageId - The message ID to edit
   * @param userId - The user ID attempting the edit
   * @param newContent - The new message content
   * @returns The updated message
   */
  async editMessage(messageId: string, userId: string, newContent: string) {
    try {
      // Fetch the message
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Permission check: Only sender can edit
      if (message.senderId !== userId) {
        throw new Error('Permission denied: You can only edit your own messages');
      }

      // Deleted messages cannot be edited
      if (message.isDeleted) {
        throw new Error('Cannot edit a deleted message');
      }

      // Time window check
      const messageAge = Date.now() - message.createdAt.getTime();
      if (messageAge > EDIT_TIME_WINDOW) {
        throw new Error(
          `Edit time window expired (${EDIT_TIME_WINDOW / 60000} minutes)`
        );
      }

      // Validate new content
      if (!newContent || newContent.trim().length === 0) {
        throw new Error('Message content cannot be empty');
      }

      if (newContent.length > 5000) {
        throw new Error('Message content too long (max 5000 characters)');
      }

      // Update message
      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
          content: newContent.trim(),
          isEdited: true,
          editedAt: new Date(),
        },
        include: {
          sender: {
            select: {
              id: true,
              clerkId: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          receiver: {
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

      logger.info('Message edited successfully', {
        messageId,
        userId,
        newContentLength: newContent.length,
        editedAt: updatedMessage.editedAt,
      });

      return updatedMessage;
    } catch (error) {
      logger.error('Failed to edit message', {
        messageId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete a message (soft delete within time window)
   * @param messageId - The message ID to delete
   * @param userId - The user ID attempting the delete
   * @returns The deleted message (with is_deleted flag)
   */
  async deleteMessage(messageId: string, userId: string) {
    try {
      // Fetch the message
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Permission check: Only sender can delete
      if (message.senderId !== userId) {
        throw new Error('Permission denied: You can only delete your own messages');
      }

      // Already deleted
      if (message.isDeleted) {
        logger.warn('Message already deleted', { messageId, userId });
        return message;
      }

      // Time window check
      const messageAge = Date.now() - message.createdAt.getTime();
      if (messageAge > DELETE_TIME_WINDOW) {
        throw new Error(
          `Delete time window expired (${DELETE_TIME_WINDOW / 60000} minutes)`
        );
      }

      // Soft delete (maintain data for audit trail)
      const deletedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          // Optional: Clear content for privacy
          // content: '[Message deleted]',
        },
        include: {
          sender: {
            select: {
              id: true,
              clerkId: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          receiver: {
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

      logger.info('Message deleted successfully', {
        messageId,
        userId,
        deletedAt: deletedMessage.deletedAt,
      });

      return deletedMessage;
    } catch (error) {
      logger.error('Failed to delete message', {
        messageId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if a message can be edited
   * @param messageId - The message ID to check
   * @param userId - The user ID attempting the edit
   * @returns Object with canEdit boolean and reason if false
   */
  async canEditMessage(
    messageId: string,
    userId: string
  ): Promise<{ canEdit: boolean; reason?: string }> {
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        return { canEdit: false, reason: 'Message not found' };
      }

      if (message.senderId !== userId) {
        return { canEdit: false, reason: 'Not the message sender' };
      }

      if (message.isDeleted) {
        return { canEdit: false, reason: 'Message is deleted' };
      }

      const messageAge = Date.now() - message.createdAt.getTime();
      if (messageAge > EDIT_TIME_WINDOW) {
        return { canEdit: false, reason: 'Edit time window expired' };
      }

      return { canEdit: true };
    } catch (error) {
      logger.error('Failed to check if message can be edited', {
        messageId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { canEdit: false, reason: 'Error checking edit permissions' };
    }
  }

  /**
   * Check if a message can be deleted
   * @param messageId - The message ID to check
   * @param userId - The user ID attempting the delete
   * @returns Object with canDelete boolean and reason if false
   */
  async canDeleteMessage(
    messageId: string,
    userId: string
  ): Promise<{ canDelete: boolean; reason?: string }> {
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        return { canDelete: false, reason: 'Message not found' };
      }

      if (message.senderId !== userId) {
        return { canDelete: false, reason: 'Not the message sender' };
      }

      if (message.isDeleted) {
        return { canDelete: false, reason: 'Message already deleted' };
      }

      const messageAge = Date.now() - message.createdAt.getTime();
      if (messageAge > DELETE_TIME_WINDOW) {
        return { canDelete: false, reason: 'Delete time window expired' };
      }

      return { canDelete: true };
    } catch (error) {
      logger.error('Failed to check if message can be deleted', {
        messageId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { canDelete: false, reason: 'Error checking delete permissions' };
    }
  }

  /**
   * Get edit history for a message (if audit trail is needed)
   * This is a placeholder - you would need an EditHistory table for full audit
   * @param messageId - The message ID
   * @returns Array of edit events
   */
  async getEditHistory(messageId: string) {
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          content: true,
          originalContent: true,
          isEdited: true,
          editedAt: true,
          createdAt: true,
        },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Simple history (current + original if edited)
      const history = [
        {
          content: message.content,
          timestamp: message.editedAt || message.createdAt,
          isCurrent: true,
        },
      ];

      if (message.isEdited && message.originalContent) {
        history.push({
          content: message.originalContent,
          timestamp: message.createdAt,
          isCurrent: false,
        });
      }

      return history;
    } catch (error) {
      logger.error('Failed to get edit history', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const messageMutationService = new MessageMutationService();
