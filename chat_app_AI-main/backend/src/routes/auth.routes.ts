import { Router, Request, Response } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/auth/sync
// Verifies Clerk token from Authorization header and ensures a DB user exists
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = auth.replace('Bearer ', '').trim();
    const session = await clerkClient.verifyToken(token);
    if (!session || !session.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Try to find existing user
    let user = await prisma.user.findUnique({ where: { clerkId: session.sub } });

    if (!user) {
      // Fetch Clerk user info
      const clerkUser = await clerkClient.users.getUser(session.sub).catch(() => null);
      const primaryEmail = clerkUser?.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId);
      const email = primaryEmail?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || '';
      user = await prisma.user.create({
        data: {
          clerkId: session.sub,
          email: email || `${session.sub}@clerk.local`,
          username: clerkUser?.username || null,
          firstName: clerkUser?.firstName || null,
          lastName: clerkUser?.lastName || null,
          avatarUrl: clerkUser?.profileImageUrl || null,
        },
      });
      logger.info(`Created DB user for clerkId=${session.sub}`);
    }

    res.json({ success: true, user });
  } catch (error) {
    logger.error('Auth sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
