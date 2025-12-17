import { Pool, QueryResult } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: config.database.url,
  ssl: { rejectUnauthorized: false }, // Enable SSL for cloud databases like Neon
  max: 10, // Reduced for cloud databases
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased to 10 seconds for cloud databases
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export async function initializeDatabase() {
  try {
    const client = await pool.connect();
    logger.info('Database connection established');
    client.release();
    await runMigrations();
  } catch (error) {
    logger.error('Database connection failed', error);
    throw error;
  }
}

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        avatar_url TEXT,
        status VARCHAR(50) DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user1_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user2_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_conversation UNIQUE(user1_id, user2_id),
        CONSTRAINT different_users CHECK (user1_id < user2_id)
      )
    `);

    // Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        original_content TEXT,
        message_type VARCHAR(50) DEFAULT 'text',
        media_url TEXT,
        tone_applied VARCHAR(50),
        status VARCHAR(50) DEFAULT 'sent',
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // FCM Tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        device_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_token UNIQUE(user_id, token)
      )
    `);

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id, created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_sender 
      ON messages(sender_id, created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_receiver 
      ON messages(receiver_id, created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_unread 
      ON messages(receiver_id, is_read, created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_users 
      ON conversations(user1_id, user2_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
      ON conversations(last_message_at DESC)
    `);

    await client.query('COMMIT');
    logger.info('Database migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text: text.substring(0, 100), error });
    throw error;
  }
}

// Export getDb for backward compatibility
export async function getDb() {
  return pool;
}
