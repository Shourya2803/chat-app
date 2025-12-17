/**
 * MESSAGE REACTIONS SERVICE
 * ==========================
 * Handles emoji reactions on messages
 * - Toggle support (add if not exists, remove if exists)
 * - Multiple reactions per user (different emojis)
 * - Aggregate counts per emoji
 * - Group chat ready
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class MessageReactionsService {
  /**
   * Toggle a reaction on a message
   * @param messageId - The message ID to react to
   * @param userId - The user ID reacting
   * @param emoji - The emoji reaction (e.g., "👍", "❤️")
   * @param username - The username (for broadcast payload)
   * @returns Object with action ('added' or 'removed') and updated counts
   */
  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string,
    username: string | null
  ) {
    try {
      // Validate emoji (basic check)
      if (!emoji || emoji.length === 0 || emoji.length > 10) {
        throw new Error('Invalid emoji');
      }

      // Check if message exists and is not deleted
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, isDeleted: true },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      if (message.isDeleted) {
        throw new Error('Cannot react to deleted messages');
      }

      // Check if reaction already exists
      const existingReaction = await prisma.messageReaction.findUnique({
        where: {
          unique_message_user_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
      });

      let action: 'added' | 'removed';

      if (existingReaction) {
        // Remove reaction (toggle off)
        await prisma.messageReaction.delete({
          where: {
            unique_message_user_emoji: {
              messageId,
              userId,
              emoji,
            },
          },
        });
        action = 'removed';

        logger.info('Reaction removed', { messageId, userId, emoji });
      } else {
        // Add reaction (toggle on)
        await prisma.messageReaction.create({
          data: {
            messageId,
            userId,
            emoji,
          },
        });
        action = 'added';

        logger.info('Reaction added', { messageId, userId, emoji });
      }

      // Get updated reaction counts
      const counts = await this.getReactionCounts(messageId);

      return {
        action,
        messageId,
        userId,
        username,
        emoji,
        counts,
      };
    } catch (error) {
      logger.error('Failed to toggle reaction', {
        messageId,
        userId,
        emoji,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all reactions for a message grouped by emoji
   * @param messageId - The message ID
   * @returns Object with emoji → count mapping and detailed user list
   */
  async getReactionCounts(messageId: string): Promise<Record<string, number>> {
    try {
      const reactions = await prisma.messageReaction.groupBy({
        by: ['emoji'],
        where: { messageId },
        _count: {
          emoji: true,
        },
      });

      const counts: Record<string, number> = {};
      reactions.forEach((reaction) => {
        counts[reaction.emoji] = reaction._count.emoji;
      });

      return counts;
    } catch (error) {
      logger.error('Failed to get reaction counts', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get detailed reactions for a message (with user info)
   * @param messageId - The message ID
   * @returns Array of reactions with user details
   */
  async getDetailedReactions(messageId: string) {
    try {
      const reactions = await prisma.messageReaction.findMany({
        where: { messageId },
        include: {
          user: {
            select: {
              id: true,
              clerkId: true,
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Group by emoji
      const grouped: Record<
        string,
        Array<{
          userId: string;
          username: string | null;
          firstName: string | null;
          lastName: string | null;
          avatarUrl: string | null;
          createdAt: Date;
        }>
      > = {};

      reactions.forEach((reaction) => {
        if (!grouped[reaction.emoji]) {
          grouped[reaction.emoji] = [];
        }

        grouped[reaction.emoji].push({
          userId: reaction.user.id,
          username: reaction.user.username,
          firstName: reaction.user.firstName,
          lastName: reaction.user.lastName,
          avatarUrl: reaction.user.avatarUrl,
          createdAt: reaction.createdAt,
        });
      });

      return grouped;
    } catch (error) {
      logger.error('Failed to get detailed reactions', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if a user has reacted with a specific emoji
   * @param messageId - The message ID
   * @param userId - The user ID
   * @param emoji - The emoji to check
   * @returns Boolean indicating if user reacted
   */
  async hasUserReacted(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<boolean> {
    try {
      const reaction = await prisma.messageReaction.findUnique({
        where: {
          unique_message_user_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
      });

      return reaction !== null;
    } catch (error) {
      logger.error('Failed to check if user reacted', {
        messageId,
        userId,
        emoji,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get all reactions by a user in a conversation (for analytics)
   * @param userId - The user ID
   * @param conversationId - The conversation ID
   * @returns Array of reactions with message details
   */
  async getUserReactionsInConversation(
    userId: string,
    conversationId: string
  ) {
    try {
      const reactions = await prisma.messageReaction.findMany({
        where: {
          userId,
          message: {
            conversationId: conversationId,
          },
        },
        include: {
          message: {
            select: {
              id: true,
              content: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reactions;
    } catch (error) {
      logger.error('Failed to get user reactions in conversation', {
        userId,
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Remove all reactions from a message (e.g., when message is deleted)
   * @param messageId - The message ID
   */
  async removeAllReactions(messageId: string): Promise<void> {
    try {
      const result = await prisma.messageReaction.deleteMany({
        where: { messageId },
      });

      logger.info('All reactions removed from message', {
        messageId,
        deletedCount: result.count,
      });
    } catch (error) {
      logger.error('Failed to remove all reactions', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get top reactions for a message (most popular)
   * @param messageId - The message ID
   * @param limit - Number of top reactions to return
   * @returns Array of emojis sorted by count (descending)
   */
  async getTopReactions(
    messageId: string,
    limit: number = 5
  ): Promise<Array<{ emoji: string; count: number }>> {
    try {
      const reactions = await prisma.messageReaction.groupBy({
        by: ['emoji'],
        where: { messageId },
        _count: {
          emoji: true,
        },
        orderBy: {
          _count: {
            emoji: 'desc',
          },
        },
        take: limit,
      });

      return reactions.map((reaction) => ({
        emoji: reaction.emoji,
        count: reaction._count.emoji,
      }));
    } catch (error) {
      logger.error('Failed to get top reactions', {
        messageId,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}

export const messageReactionsService = new MessageReactionsService();
