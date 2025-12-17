import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { redis, presenceService } from './src/lib/server/database/redis';
import prisma from './src/lib/server/database/prisma';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('✓ Database connected successfully');
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    process.exit(1);
  }

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const session = await clerkClient.verifyToken(token);
      if (!session) {
        return next(new Error('Authentication error: Invalid token'));
      }

      socket.data.userId = session.sub;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log(`User connected: ${userId}`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Handle joining conversations
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${userId} joined conversation ${conversationId}`);
    });

    // Handle leaving conversations
    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${userId} left conversation ${conversationId}`);
    });

    // Handle sending messages
    socket.on('send-message', async (data: {
      conversationId: string;
      receiverId: string;
      content: string;
      mediaUrl?: string;
      applyTone?: boolean;
      toneType?: string;
    }) => {
      try {
        console.log('🔥 send-message event triggered');
        console.log('📩 Full payload received:', JSON.stringify(data, null, 2));

        // Get sender user
        const sender = await prisma.user.findUnique({
          where: { clerkId: userId },
          select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        });

        if (!sender) {
          console.error('❌ Sender not found:', userId);
          socket.emit('message-error', { error: 'User not found' });
          return;
        }

        console.log('✅ Sender found:', sender.id);

        // Apply tone if requested
        let finalContent = data.content;
        let originalContent = data.content;
        let appliedTone = null;

        console.log('📝 Message content:', data.content);
        console.log('🎨 Apply tone?', data.applyTone, 'Type:', data.toneType);

        if (data.applyTone && data.toneType && data.content && data.content.trim()) {
          console.log('🤖 Applying tone conversion:', data.toneType);
          console.log('📝 Raw content:', data.content);
          try {
            const { aiService } = await import('./src/lib/server/services/ai.service');
            
            // Add timeout for Gemini API
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Gemini API timeout after 10s')), 10000)
            );
            
            const result = await Promise.race([
              aiService.convertTone(data.content, data.toneType as any),
              timeoutPromise
            ]) as any;
            
            console.log('🤖 AI result:', result);
            
            if (result.success && result.convertedText) {
              finalContent = result.convertedText;
              appliedTone = data.toneType;
              console.log('✅ Tone conversion successful!');
              console.log('   Original:', data.content);
              console.log('   Converted:', finalContent);
            } else {
              console.error('❌ Tone conversion failed:', result.error);
              console.log('⚠️ Using original message');
            }
          } catch (error: any) {
            console.error('❌ Tone conversion error:', error.message);
            console.log('⚠️ Using original message due to error');
          }
        } else {
          console.log('⏭️ Skipping tone conversion - conditions not met');
          console.log('   applyTone:', data.applyTone);
          console.log('   toneType:', data.toneType);
          console.log('   hasContent:', !!data.content);
        }

        // Create message in database
        console.log('💾 Saving to database...');
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
        console.log('✅ Message saved to DB:', message.id);

        // Update conversation last message time
        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { lastMessageAt: new Date() },
        });

        // Format message for clients
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

        console.log('📡 Emitting message to clients...');
        
        // Emit to sender
        socket.emit('message-sent', formattedMessage);

        // Emit to conversation room (this reaches the receiver)
        socket.to(`conversation:${data.conversationId}`).emit('new-message', formattedMessage);
        console.log('📤 Broadcast to conversation:', data.conversationId);
        
        console.log('✅ Message flow complete!');
      } catch (error) {
        console.error('❌ Send message error:', error);
        socket.emit('message-error', { error: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${conversationId}`).emit('user-typing', {
        userId,
        conversationId,
        isTyping,
      });
    });

    // Handle mark as read
    socket.on('mark-read', async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('message-read', {
        conversationId,
        messageId,
        readBy: userId,
      });
    });

    // Handle presence/heartbeat
    socket.on('heartbeat', async () => {
      await presenceService.setOnline(userId);
      
      // Broadcast online status
      io.emit('user-status', {
        userId,
        status: 'online',
        lastSeen: Date.now(),
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      await presenceService.setOffline(userId);
      
      // Broadcast offline status
      io.emit('user-status', {
        userId,
        status: 'offline',
        lastSeen: Date.now(),
      });
    });
  });

  // Make io instance available globally for API routes
  (global as any).io = io;

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
    });
});
