import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { logger } from '../utils/logger';

const router = Router();

async function authenticate(req: Request) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.replace('Bearer ', '').trim();
  const session = await clerkClient.verifyToken(token).catch(() => null);
  return session?.sub || null;
}

// POST /api/messages/conversation
// body: { userId } (other user's DB id)
router.post('/', async (req: Request, res: Response) => {
  try {
    const clerkId = await authenticate(req) as string | null;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const { userId: otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'Missing userId' });

    const me = await prisma.user.findUnique({ where: { clerkId } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    // Ensure consistent ordering to use unique constraint
    const [user1Id, user2Id] = me.id < otherUserId ? [me.id, otherUserId] : [otherUserId, me.id];

    let conversation = await prisma.conversation.findUnique({
      where: { unique_conversation: { user1Id, user2Id } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { user1Id, user2Id },
      });
    }

    res.json({ success: true, data: { conversationId: conversation.id } });
  } catch (error) {
    logger.error('Create/get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/conversation/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await prisma.message.findMany({
      where: { conversationId: id, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });

    res.json({ success: true, data: { messages } });
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
    const { content, mediaUrl } = req.body;

    const me = await prisma.user.findUnique({ where: { clerkId } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const receiverId = conversation.user1Id === me.id ? conversation.user2Id : conversation.user1Id;

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: me.id,
        receiverId,
        content: content || '',
        mediaUrl: mediaUrl || null,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });

    res.json({ success: true, data: { message } });
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

export default router;
