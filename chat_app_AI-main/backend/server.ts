

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkClient } from '@clerk/clerk-sdk-node';

// Import backend services
import { prisma } from './src/lib/prisma';
import { redis, presenceService } from './src/lib/redis';
import { aiService } from './src/services/ai.service';
import { logger } from './src/utils/logger';
import { readReceiptsService } from './src/services/read-receipts.service';
import { typingIndicatorsService } from './src/services/typing.service';
import { messageMutationService } from './src/services/message-mutation.service';
import { messageReactionsService } from './src/services/reactions.service';
import { fcmNotificationService } from './src/services/fcm.service';
import { notificationService } from './src/services/notification.service';

// Import routes
import cronRoutes from './src/routes/cron.routes';
import notificationRoutes from './src/routes/notification.routes';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration - Allow frontend domains
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://*.vercel.app', // Allow all Vercel preview deployments
].filter(Boolean);

// ========================================
// EXPRESS + HTTP SERVER SETUP
// ========================================

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed patterns
    const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Health check endpoint (for Render health checks)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Chat App Backend API',
    version: '1.0.0',
    socketIO: 'ready',
    environment: NODE_ENV,
  });
});

// Mount routes
app.use('/api/cron', cronRoutes);
app.use('/api/notifications', notificationRoutes);

// ========================================
// SOCKET.IO SERVER SETUP
// ========================================

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace('*', '.*');
          return new RegExp(pattern).test(origin);
        }
        return allowedOrigin === origin;
      });
      callback(null, isAllowed);
    },
    credentials: true,
  },
  // Use WebSocket transport for better performance on Render
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ========================================
// SOCKET.IO AUTHENTICATION MIDDLEWARE
// ========================================

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logger.warn('Socket connection rejected: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify Clerk token
    const session = await clerkClient.verifyToken(token);
    
    if (!session || !session.sub) {
      logger.warn('Socket connection rejected: Invalid token');
      return next(new Error('Authentication error: Invalid token'));
    }

    // Store Clerk ID in socket data
    socket.data.clerkId = session.sub;
    
    // Fetch the database user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: session.sub },
      select: { id: true, clerkId: true, username: true },
    });

    if (!user) {
      logger.warn(`Socket connection rejected: User not found for Clerk ID ${session.sub}`);
      return next(new Error('Authentication error: User not found'));
    }

    // Store database user ID in socket data
    socket.data.userId = user.id;
    socket.data.dbUserId = user.id;
    
    logger.info(`Socket authenticated: ${user.username} (${user.clerkId})`);
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

// ========================================
// SOCKET.IO CONNECTION HANDLER
// ========================================

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  const clerkId = socket.data.clerkId;
  
  logger.info(`✅ User connected: ${clerkId} (DB ID: ${userId})`);

  // Join user's personal room for direct notifications
  socket.join(`user:${userId}`);

  // ========================================
  // EVENT: JOIN CONVERSATION
  // ========================================
  socket.on('join-conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
    logger.info(`User ${userId} joined conversation ${conversationId}`);
  });

  // ========================================
  // EVENT: LEAVE CONVERSATION
  // ========================================
  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
    logger.info(`User ${userId} left conversation ${conversationId}`);
  });

  // ========================================
  // EVENT: SEND MESSAGE
  // ========================================
  socket.on('send-message', async (data: {
    conversationId: string;
    receiverId: string;
    content: string;
    mediaUrl?: string;
    applyTone?: boolean;
    toneType?: 'professional' | 'polite' | 'formal' | 'auto';
  }) => {
    try {
      logger.info('📩 send-message event triggered', {
        conversationId: data.conversationId,
        senderId: userId,
        receiverId: data.receiverId,
        applyTone: data.applyTone,
        toneType: data.toneType,
      });

      // Get sender user
      const sender = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          username: true, 
          firstName: true, 
          lastName: true, 
          avatarUrl: true 
        },
      });

      if (!sender) {
        logger.error(`❌ Sender not found: ${userId}`);
        socket.emit('message-error', { error: 'User not found' });
        return;
      }

      // Apply tone conversion if requested
      let finalContent = data.content;
      let originalContent = data.content;
      let appliedTone = null;

      if (data.applyTone && data.toneType && data.content && data.content.trim()) {
        logger.info(`🤖 Applying tone conversion: ${data.toneType}`);
        
        try {
          // Add timeout for Gemini API (10 seconds)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Gemini API timeout after 10s')), 10000)
          );
          
          const result = await Promise.race([
            aiService.convertTone(data.content, data.toneType),
            timeoutPromise
          ]) as any;
          
          if (result.success && result.convertedText) {
            finalContent = result.convertedText;
            appliedTone = data.toneType;
            logger.info('✅ Tone conversion successful');
          } else {
            logger.warn('⚠️ Tone conversion failed, using original message');
          }
        } catch (error: any) {
          logger.error(`❌ Tone conversion error: ${error.message}`);
          logger.warn('⚠️ Using original message due to error');
        }
      }

      // Create message in database
      logger.info('💾 Saving message to database...');
      const message = await prisma.message.create({
        data: {
          conversationId: data.conversationId,
          senderId: sender.id,
          receiverId: data.receiverId,
          content: finalContent,
          originalContent: originalContent,
          toneApplied: appliedTone,
          mediaUrl: data.mediaUrl || null,
        },
      });
      logger.info(`✅ Message saved: ${message.id}`);

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Format message for clients (snake_case for consistency with API)
      const formattedMessage = {
        id: message.id,
        conversation_id: message.conversationId,
        sender_id: message.senderId,
        receiver_id: message.receiverId,
        content: message.content,
        original_content: message.originalContent,
        tone_applied: message.toneApplied,
        message_type: message.mediaUrl ? 'image' : 'text',
        media_url: message.mediaUrl,
        status: 'sent',
        is_read: false,
        read_at: null,
        created_at: message.createdAt,
        updated_at: message.updatedAt,
      };

      // Emit to sender (confirmation)
      socket.emit('message-sent', formattedMessage);

      // Emit to receiver via conversation room
      socket.to(`conversation:${data.conversationId}`).emit('new-message', formattedMessage);
      
      logger.info(`📤 Message broadcast to conversation:${data.conversationId}`);

      // Create notification (in-app + FCM + email)
      try {
        const senderName = sender.username || sender.firstName || 'Someone';
        const notification = await notificationService.createNotification({
          userId: data.receiverId,
          type: 'message',
          title: `New message from ${senderName}`,
          body: finalContent.substring(0, 100),
          actionUrl: `/chat?conversation=${data.conversationId}`,
          metadata: {
            messageId: message.id,
            conversationId: data.conversationId,
            senderId: sender.id,
            senderName,
          },
          sendPush: true,
          sendEmail: false, // Set to true if you want email for every message
        });

        // Emit real-time notification to receiver
        if (notification) {
          io.to(`user:${data.receiverId}`).emit('new-notification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            actionUrl: notification.actionUrl,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
            metadata: notification.metadata,
          });
        }
      } catch (notifError) {
        logger.error('Notification failed (non-blocking):', notifError);
      }
    } catch (error) {
      logger.error('❌ Send message error:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // ========================================
  // EVENT: READ RECEIPTS
  // ========================================
  socket.on('message:read', async (data: { messageId: string; conversationId: string }) => {
    try {
      const messageRead = await readReceiptsService.markMessageAsRead(data.messageId, userId);
      
      // Broadcast read receipt to conversation
      io.to(`conversation:${data.conversationId}`).emit('message:read:update', {
        messageId: data.messageId,
        conversationId: data.conversationId,
        userId: userId,
        username: messageRead.user?.username || null,
        readAt: messageRead.readAt,
      });

      logger.info('Read receipt broadcast', {
        messageId: data.messageId,
        userId,
        conversationId: data.conversationId,
      });
    } catch (error) {
      logger.error('Read receipt error:', error);
      socket.emit('message-error', { error: 'Failed to mark message as read' });
    }
  });

  // ========================================
  // EVENT: TYPING INDICATORS (START)
  // ========================================
  socket.on('typing:start', async (data: { conversationId: string }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      const processed = await typingIndicatorsService.setTyping(
        data.conversationId,
        userId,
        user?.username || null
      );

      if (processed) {
        // Broadcast to conversation (exclude sender)
        socket.to(`conversation:${data.conversationId}`).emit('user:typing', {
          conversationId: data.conversationId,
          userId,
          username: user?.username || null,
          isTyping: true,
        });
      }
    } catch (error) {
      logger.error('Typing start error:', error);
    }
  });

  // ========================================
  // EVENT: TYPING INDICATORS (STOP)
  // ========================================
  socket.on('typing:stop', async (data: { conversationId: string }) => {
    try {
      await typingIndicatorsService.stopTyping(data.conversationId, userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      // Broadcast stop typing
      socket.to(`conversation:${data.conversationId}`).emit('user:typing', {
        conversationId: data.conversationId,
        userId,
        username: user?.username || null,
        isTyping: false,
      });
    } catch (error) {
      logger.error('Typing stop error:', error);
    }
  });

  // ========================================
  // EVENT: MESSAGE EDIT
  // ========================================
  socket.on('message:edit', async (data: { messageId: string; conversationId: string; newContent: string }) => {
    try {
      const updatedMessage = await messageMutationService.editMessage(
        data.messageId,
        userId,
        data.newContent
      );

      // Send success confirmation to sender
      socket.emit('message:edit:success', {
        messageId: data.messageId,
        message: 'Message edited successfully',
      });

      // Broadcast edit to conversation
      io.to(`conversation:${data.conversationId}`).emit('message:edited', {
        messageId: data.messageId,
        conversationId: data.conversationId,
        newContent: updatedMessage.content,
        editedAt: updatedMessage.editedAt,
        senderId: updatedMessage.senderId,
      });

      logger.info('Message edited and broadcast', {
        messageId: data.messageId,
        userId,
      });
    } catch (error: any) {
      logger.error('Message edit error:', error);
      socket.emit('message-error', { 
        error: error.message || 'Failed to edit message',
        code: 'EDIT_FAILED',
      });
    }
  });

  // ========================================
  // EVENT: MESSAGE DELETE
  // ========================================
  socket.on('message:delete', async (data: { messageId: string; conversationId: string }) => {
    try {
      const deletedMessage = await messageMutationService.deleteMessage(data.messageId, userId);

      // Send success confirmation to sender
      socket.emit('message:delete:success', {
        messageId: data.messageId,
        message: 'Message deleted successfully',
      });

      // Broadcast delete to conversation
      io.to(`conversation:${data.conversationId}`).emit('message:deleted', {
        messageId: data.messageId,
        conversationId: data.conversationId,
        deletedAt: deletedMessage.deletedAt,
        senderId: deletedMessage.senderId,
      });

      logger.info('Message deleted and broadcast', {
        messageId: data.messageId,
        userId,
      });
    } catch (error: any) {
      logger.error('Message delete error:', error);
      socket.emit('message-error', { 
        error: error.message || 'Failed to delete message',
        code: 'DELETE_FAILED',
      });
    }
  });

  // ========================================
  // EVENT: MESSAGE REACTIONS
  // ========================================
  socket.on('message:react', async (data: { messageId: string; conversationId: string; emoji: string }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      const result = await messageReactionsService.toggleReaction(
        data.messageId,
        userId,
        data.emoji,
        user?.username || null
      );

      // Broadcast reaction update
      const eventName = result.action === 'added' ? 'message:reaction:added' : 'message:reaction:removed';
      
      io.to(`conversation:${data.conversationId}`).emit(eventName, {
        messageId: data.messageId,
        conversationId: data.conversationId,
        userId: result.userId,
        username: result.username,
        emoji: result.emoji,
        reactionCounts: result.counts,
      });

      logger.info(`Reaction ${result.action}`, {
        messageId: data.messageId,
        userId,
        emoji: data.emoji,
      });
    } catch (error: any) {
      logger.error('Message reaction error:', error);
      socket.emit('message-error', { 
        error: error.message || 'Failed to react to message',
        code: 'REACTION_FAILED',
      });
    }
  });

  // ========================================
  // EVENT: HEARTBEAT / PRESENCE
  // ========================================
  socket.on('heartbeat', async () => {
    await presenceService.setOnline(userId);
    
    // Broadcast online status to all connected clients
    io.emit('user-status', {
      userId,
      status: 'online',
      lastSeen: Date.now(),
    });
  });

  // ========================================
  // EVENT: DISCONNECT
  // ========================================
  socket.on('disconnect', async () => {
    logger.info(`❌ User disconnected: ${clerkId} (DB ID: ${userId})`);
    
    await presenceService.setOffline(userId);
    
    // Broadcast offline status
    io.emit('user-status', {
      userId,
      status: 'offline',
      lastSeen: Date.now(),
    });
  });
});

// ========================================
// DATABASE CONNECTION & SERVER STARTUP
// ========================================

async function startServer() {
  try {
    // Test Prisma connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Test Redis connection (optional, don't block on failure)
    try {
      await redis.ping();
      logger.info('✅ Redis connected successfully');
    } catch (redisError) {
      logger.warn('⚠️ Redis connection failed - presence features may be limited');
    }

    // Start HTTP + Socket.IO server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Backend server running on port ${PORT}`);
      logger.info(`📡 Socket.IO server ready`);
      logger.info(`🌍 Environment: ${NODE_ENV}`);
      logger.info(`🔗 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  await redis.quit();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();
