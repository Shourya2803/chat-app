import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { logger } from '../utils/logger';
import { aiService, ToneType } from '../services/ai.service';
import { notificationService } from '../services/notification.service';
import { getUserRole } from '../lib/server/auth';

const router = Router();

async function authenticate(req: Request) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.replace('Bearer ', '').trim();
  const session = await clerkClient.verifyToken(token).catch(() => null);
  return session?.sub || null;
}

// Helper to format message for frontend (snake_case)
function formatMessage(message: any) {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    content: message.content,
    original_content: message.originalContent,
    tone_applied: message.toneApplied,
    message_type: message.mediaUrl ? 'image' : 'text',
    media_url: message.mediaUrl,
    status: message.status || 'sent',
    is_read: message.isRead,
    read_at: message.readAt,
    created_at: message.createdAt,
    updated_at: message.updatedAt,
  };
}

// POST /api/messages/conversation -> dummy for global
router.post('/', async (req: Request, res: Response) => {
  res.json({ success: true, data: { conversationId: 'global-group' } });
});

// GET /api/messages/conversation/:id -> get messages for global-group
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const conversation = await (prisma.conversation as any).findUnique({
      where: { id: 'global-group' },
      select: { name: true }
    });

    const messages = await prisma.message.findMany({
      where: { conversationId: 'global-group', isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        sender: {
          select: { username: true }
        }
      }
    });

    const clerkId = await authenticate(req);
    const userRole = clerkId ? await getUserRole(clerkId) : 'USER';
    const dbUser = clerkId ? await prisma.user.findUnique({ where: { clerkId } }) : null;
    const currentDbUserId = (dbUser as any)?.id;

    const data = messages.map(m => {
      const formatted = formatMessage(m);
      return {
        ...formatted,
        content: userRole === 'ADMIN' || currentDbUserId === m.senderId
          ? m.originalContent
          : m.content,
        sender_username: m.sender.username
      };
    });

    res.json({
      success: true,
      data: {
        name: (conversation as any)?.name || 'Corporate General Chat',
        messages: data.reverse()
      }
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/conversation/:id  -> create message in conversation
router.post('/:id', async (req: Request, res: Response) => {
  try {
    const clerkId = await authenticate(req) as string | null;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { content, mediaUrl, tone } = req.body;

    const me = await prisma.user.findUnique({ where: { clerkId } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const receiverId = conversation.user1Id === me.id ? conversation.user2Id : conversation.user1Id;

    // Apply tone conversion if requested
    let finalContent = content || '';
    let originalContentSnippet = content || '';
    let appliedTone = null;

    if (tone && content && content.trim()) {
      logger.info(`🤖 REST: Applying tone conversion: ${tone} for session: ${clerkId}`);
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout after 30s')), 30000)
        );

        const result = await Promise.race([
          aiService.convertTone(content, tone as ToneType),
          timeoutPromise
        ]) as any;

        if (result.success && result.convertedText) {
          finalContent = result.convertedText;
          appliedTone = tone as ToneType;
          logger.info('✅ REST: Tone conversion successful');
        } else {
          logger.warn(`⚠️ REST: Tone conversion failed: ${result.error || 'Empty response'}`);
        }
      } catch (error: any) {
        logger.error(`❌ REST: Tone conversion error: ${error.message}`);
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: me.id,
        receiverId,
        content: finalContent,
        originalContent: originalContentSnippet,
        toneApplied: appliedTone,
        mediaUrl: mediaUrl || null,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });

    // Send notifications (non-blocking)
    try {
      const senderName = me.username || me.firstName || 'Someone';
      await notificationService.createNotification({
        userId: receiverId,
        type: 'message',
        title: `New message from ${senderName}`,
        body: finalContent.substring(0, 100),
        actionUrl: `/chat?conversation=${id}`,
        metadata: {
          messageId: message.id,
          conversationId: id,
          senderId: me.id,
          senderName,
        },
        sendPush: true,
        sendEmail: false,
      }).catch(err => logger.error('REST Notification error (captured):', err));
    } catch (notifError) {
      logger.error('REST Notification failed (non-blocking):', notifError);
    }

    res.json({ success: true, data: { message: formatMessage(message) } });
  } catch (error) {
    logger.error('Create message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/conversation/:id/read
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const clerkId = await authenticate(req) as string | null;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    // Simple implementation: mark all messages in conversation as read for this user
    const me = await prisma.user.findUnique({ where: { clerkId } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    await prisma.message.updateMany({
      where: { conversationId: id, receiverId: me.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Mark conversation read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/messages/conversation/:id/name -> update group name (admin only)
router.patch('/:id/name', async (req: Request, res: Response) => {
  try {
    const clerkId = await authenticate(req) as string | null;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await prisma.user.findUnique({ where: { clerkId } });
    if (!me || (me as any).role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can update group settings' });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const conversation = await (prisma.conversation as any).update({
      where: { id },
      data: { name: name.trim() }
    });

    res.json({ success: true, data: { name: (conversation as any).name } });
  } catch (error) {
    logger.error('Update group name error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
