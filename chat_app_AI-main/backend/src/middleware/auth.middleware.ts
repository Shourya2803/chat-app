import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        clerkId: string;
    };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const session = await clerkClient.verifyToken(token);

        if (!session || !session.sub) {
            logger.warn('Auth Middleware: session.sub missing');
            return res.status(401).json({ error: 'Invalid token' });
        }

        logger.debug(`Auth Middleware: Searching for user with clerkId: ${session.sub}`);

        const user = await prisma.user.findUnique({
            where: { clerkId: session.sub },
            select: { id: true, clerkId: true }
        });

        if (!user) {
            logger.warn(`Auth Middleware: User not found for clerkId: ${session.sub}`);
            return res.status(401).json({ error: 'User not found in database' });
        }

        logger.info(`Auth Middleware: Successfully authenticated user ${user.id}`);

        req.user = {
            userId: user.id,
            clerkId: user.clerkId
        };

        next();
    } catch (error) {
        logger.error('Authentication middleware error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
};
