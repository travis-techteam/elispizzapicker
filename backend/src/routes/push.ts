import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  getVapidPublicKey,
  isPushEnabled,
  saveSubscription,
  deleteSubscription,
  getSubscription,
} from '../services/push.service.js';
import logger from '../utils/logger.js';

const router = Router();

// Push subscription schema
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  expirationTime: z.number().nullable().optional(),
});

/**
 * @swagger
 * /api/push/vapid-public-key:
 *   get:
 *     summary: Get VAPID public key for push notifications
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: VAPID public key
 */
router.get('/vapid-public-key', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  if (!isPushEnabled()) {
    res.status(503).json({
      success: false,
      error: 'Push notifications are not configured',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      publicKey: getVapidPublicKey(),
    },
  });
});

/**
 * @swagger
 * /api/push/status:
 *   get:
 *     summary: Get current user's push subscription status
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status
 */
router.get('/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscription = await getSubscription(req.user!.userId);

    res.json({
      success: true,
      data: {
        enabled: isPushEnabled(),
        subscribed: !!subscription,
      },
    });
  } catch (error) {
    logger.error({ err: error, userId: req.user?.userId }, 'Failed to get push status');
    res.status(500).json({
      success: false,
      error: 'Failed to get push notification status',
    });
  }
});

/**
 * @swagger
 * /api/push/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endpoint:
 *                 type: string
 *               keys:
 *                 type: object
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *     responses:
 *       200:
 *         description: Subscription saved
 */
router.post('/subscribe', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isPushEnabled()) {
      res.status(503).json({
        success: false,
        error: 'Push notifications are not configured',
      });
      return;
    }

    const subscription = subscriptionSchema.parse(req.body);

    await saveSubscription(req.user!.userId, subscription);

    res.json({
      success: true,
      message: 'Push subscription saved',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid subscription data',
        details: error.errors,
      });
      return;
    }
    logger.error({ err: error, userId: req.user?.userId }, 'Failed to save push subscription');
    res.status(500).json({
      success: false,
      error: 'Failed to save push subscription',
    });
  }
});

/**
 * @swagger
 * /api/push/subscribe:
 *   delete:
 *     summary: Unsubscribe from push notifications
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription removed
 */
router.delete('/subscribe', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await deleteSubscription(req.user!.userId);

    res.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    logger.error({ err: error, userId: req.user?.userId }, 'Failed to delete push subscription');
    res.status(500).json({
      success: false,
      error: 'Failed to remove push subscription',
    });
  }
});

export default router;
