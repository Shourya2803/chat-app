import { Router, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all notification routes
router.use(authenticate);

/**
 * GET /api/notifications
 * Get all notifications for authenticated user
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId; // Guaranteed by middleware

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await notificationService.getAllNotifications(userId, limit, offset);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/unread
 * Get unread notifications count
 */
router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const success = await notificationService.markAsRead(id, userId);

    res.json({ success });
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const success = await notificationService.deleteNotification(id, userId);

    res.json({ success });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
