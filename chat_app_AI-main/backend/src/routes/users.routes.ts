import { Router, Request, Response } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: { userId: string };
}

const router = Router();

// Helper: authenticate via Authorization header (Clerk token)
async function authenticate(req: Request) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.replace('Bearer ', '').trim();
  const session = await clerkClient.verifyToken(token).catch(() => null);
  return session?.sub || null;
}

// GET /api/users?q=search  -> search users (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true },
      take: 20,
    });

    res.json({ success: true, users });
  } catch (error) {
    logger.error('User search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me -> authenticated user profile
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = await authenticate(req);
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (error) {
    logger.error('Get /users/me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/conversations/list -> list user's conversations (simple)
router.get('/conversations/list', async (req: Request, res: Response) => {
  try {
    const clerkId = await authenticate(req) as string | null;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: dbUser.id }, { user2Id: dbUser.id }]
      },
      include: {
        user1: { select: { id: true, username: true, avatarUrl: true } },
        user2: { select: { id: true, username: true, avatarUrl: true } }
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, conversations });
  } catch (error) {
    logger.error('Get conversations list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/conversations -> alias for older frontend calls
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const clerkId = await authenticate(req) as string | null;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const rConversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: dbUser.id }, { user2Id: dbUser.id }]
      },
      include: {
        user1: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true, status: true, email: true } },
        user2: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true, status: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });

    // Transform to match frontend store expectation
    // Transform to match frontend store expectation
    const conversations = await Promise.all(rConversations.map(async conv => {
      const isUser1 = conv.user1Id === dbUser.id;
      const otherUserRaw = isUser1 ? conv.user2 : conv.user1;

      const lastMsg = conv.messages[0];

      // Calculate unread count
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          isRead: false,
          senderId: { not: dbUser.id }
        }
      });

      return {
        conversation_id: conv.id,
        other_user: {
          id: otherUserRaw.id,
          username: otherUserRaw.username,
          first_name: otherUserRaw.firstName,
          last_name: otherUserRaw.lastName,
          email: otherUserRaw.email,
          avatar_url: otherUserRaw.avatarUrl,
          status: otherUserRaw.status
        },
        last_message: lastMsg ? {
          id: lastMsg.id,
          content: lastMsg.content,
          sender_id: lastMsg.senderId,
          created_at: lastMsg.createdAt,
          is_read: lastMsg.isRead
        } : null,
        unread_count: unreadCount
      };
    }));

    res.json({ success: true, conversations });
  } catch (error) {
    logger.error('Get conversations alias error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Get user by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
