import { query } from '../database/client';
import { cacheService, unreadService } from '../database/redis';
import { logger } from '../utils/logger';
import { ToneType } from './ai.service';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  original_content?: string;
  message_type: string;
  media_url?: string;
  tone_applied?: string;
  status: string;
  is_read: boolean;
  read_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMessageData {
  conversationId?: string;
  senderId: string;
  receiverId: string;
  content: string;
  originalContent?: string;
  messageType?: string;
  mediaUrl?: string;
  toneApplied?: ToneType;
}

export class MessageService {
  async createMessage(data: CreateMessageData): Promise<Message> {
    try {
      // Ensure conversation exists
      const conversationId = data.conversationId || await this.getOrCreateConversation(
        data.senderId,
        data.receiverId
      );

      const result = await query(
        `INSERT INTO messages (
           conversation_id, sender_id, receiver_id, content, 
           original_content, message_type, media_url, tone_applied
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          conversationId,
          data.senderId,
          data.receiverId,
          data.content,
          data.originalContent || null,
          data.messageType || 'text',
          data.mediaUrl || null,
          data.toneApplied || null,
        ]
      );

      // Update conversation last_message_at
      await query(
        'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );

      // Increment unread count for receiver
      await unreadService.increment(data.receiverId, conversationId);

      const message = result.rows[0];
      logger.info('Message created', { messageId: message.id, conversationId });
      
      return message;
    } catch (error) {
      logger.error('Failed to create message', { error, data });
      throw error;
    }
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    try {
      // Verify user is part of conversation
      const convResult = await query(
        'SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
        [conversationId, userId]
      );

      if (convResult.rows.length === 0) {
        throw new Error('Unauthorized access to conversation');
      }

      const result = await query(
        `SELECT * FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return result.rows.reverse(); // Oldest first for display
    } catch (error) {
      logger.error('Failed to get messages', { error, conversationId, userId });
      throw error;
    }
  }

  async markAsRead(messageId: string, userId: string): Promise<void> {
    try {
      await query(
        `UPDATE messages 
         SET is_read = true, read_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND receiver_id = $2 AND is_read = false`,
        [messageId, userId]
      );
    } catch (error) {
      logger.error('Failed to mark message as read', { error, messageId, userId });
    }
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await query(
        `UPDATE messages 
         SET is_read = true, read_at = CURRENT_TIMESTAMP 
         WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = false`,
        [conversationId, userId]
      );

      // Reset unread count
      await unreadService.reset(userId, conversationId);

      logger.info('Conversation marked as read', { conversationId, userId });
    } catch (error) {
      logger.error('Failed to mark conversation as read', { error, conversationId, userId });
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    try {
      const result = await query(
        'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING media_url',
        [messageId, userId]
      );

      if (result.rows.length > 0 && result.rows[0].media_url) {
        // Delete media file if exists
        // This would be handled by storage service
      }

      logger.info('Message deleted', { messageId, userId });
    } catch (error) {
      logger.error('Failed to delete message', { error, messageId, userId });
      throw error;
    }
  }

  async getOrCreateConversation(user1Id: string, user2Id: string): Promise<string> {
    try {
      // Ensure consistent ordering
      const [smallerId, largerId] = [user1Id, user2Id].sort();

      const result = await query(
        `INSERT INTO conversations (user1_id, user2_id)
         VALUES ($1, $2)
         ON CONFLICT (user1_id, user2_id) 
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [smallerId, largerId]
      );

      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to get/create conversation', { error, user1Id, user2Id });
      throw error;
    }
  }

  async getConversationByUsers(user1Id: string, user2Id: string): Promise<string | null> {
    try {
      const [smallerId, largerId] = [user1Id, user2Id].sort();

      const result = await query(
        'SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2',
        [smallerId, largerId]
      );

      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      logger.error('Failed to get conversation', { error, user1Id, user2Id });
      return null;
    }
  }

  async getUnreadCount(userId: string): Promise<Record<string, number>> {
    try {
      return await unreadService.getAllCounts(userId);
    } catch (error) {
      logger.error('Failed to get unread counts', { error, userId });
      return {};
    }
  }
}

export const messageService = new MessageService();
