import { query } from '../database/client';
import { cacheService } from '../database/redis';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  status: string;
  last_seen: Date;
  created_at: Date;
  updated_at: Date;
}

export class UserService {
  async createUser(userData: {
    id: string;
    clerkId: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  }): Promise<User> {
    try {
      const result = await query(
        `INSERT INTO users (id, clerk_id, email, username, first_name, last_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (clerk_id) 
         DO UPDATE SET 
           email = $3,
           username = $4,
           first_name = $5,
           last_name = $6,
           avatar_url = $7,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          userData.id,
          userData.clerkId,
          userData.email,
          userData.username || null,
          userData.firstName || null,
          userData.lastName || null,
          userData.avatarUrl || null,
        ]
      );

      const user = result.rows[0];
      await cacheService.set(`user:${user.id}`, user, 3600);
      
      logger.info('User created/updated', { userId: user.id });
      return user;
    } catch (error) {
      logger.error('Failed to create user', { error, userData });
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      // Check cache first
      const cached = await cacheService.get<User>(`user:${userId}`);
      if (cached) return cached;

      const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
      
      if (result.rows.length === 0) return null;

      const user = result.rows[0];
      await cacheService.set(`user:${userId}`, user, 3600);
      
      return user;
    } catch (error) {
      logger.error('Failed to get user', { error, userId });
      throw error;
    }
  }

  async searchUsers(searchTerm: string, currentUserId: string, limit: number = 20): Promise<User[]> {
    try {
      const result = await query(
        `SELECT * FROM users 
         WHERE id != $1 AND (
           username ILIKE $2 OR 
           email ILIKE $2 OR 
           first_name ILIKE $2 OR 
           last_name ILIKE $2
         )
         LIMIT $3`,
        [currentUserId, `%${searchTerm}%`, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to search users', { error, searchTerm });
      throw error;
    }
  }

  async updateUserStatus(userId: string, status: string): Promise<void> {
    try {
      await query(
        'UPDATE users SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2',
        [status, userId]
      );

      await cacheService.del(`user:${userId}`);
    } catch (error) {
      logger.error('Failed to update user status', { error, userId, status });
    }
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      const result = await query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      const user = result.rows[0];
      await cacheService.del(`user:${userId}`);
      
      return user;
    } catch (error) {
      logger.error('Failed to update profile', { error, userId, updates });
      throw error;
    }
  }

  async getUserConversations(userId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT 
           c.id as conversation_id,
           c.last_message_at,
           CASE 
             WHEN c.user1_id = $1 THEN u2.*
             ELSE u1.*
           END as other_user,
           (
             SELECT json_build_object(
               'id', m.id,
               'content', m.content,
               'sender_id', m.sender_id,
               'created_at', m.created_at,
               'is_read', m.is_read
             )
             FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC
             LIMIT 1
           ) as last_message,
           (
             SELECT COUNT(*)::int
             FROM messages m
             WHERE m.conversation_id = c.id 
               AND m.receiver_id = $1 
               AND m.is_read = false
           ) as unread_count
         FROM conversations c
         LEFT JOIN users u1 ON c.user1_id = u1.id
         LEFT JOIN users u2 ON c.user2_id = u2.id
         WHERE c.user1_id = $1 OR c.user2_id = $1
         ORDER BY c.last_message_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get user conversations', { error, userId });
      throw error;
    }
  }
}

export const userService = new UserService();
