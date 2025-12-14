import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  getEventHistory,
  getPizzaTrends,
  getParticipationStats,
  getEventHistoryCount,
} from '../services/analytics.service.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * @swagger
 * /api/analytics/history:
 *   get:
 *     summary: Get event history with statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of events to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of events to skip
 *     responses:
 *       200:
 *         description: Event history retrieved successfully
 */
router.get('/history', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [history, total] = await Promise.all([
      getEventHistory(limit, offset),
      getEventHistoryCount(),
    ]);

    res.json({
      success: true,
      data: history,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + history.length < total,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get event history');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve event history',
    });
  }
});

/**
 * @swagger
 * /api/analytics/trends:
 *   get:
 *     summary: Get pizza popularity trends
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of top pizzas to return
 *     responses:
 *       200:
 *         description: Pizza trends retrieved successfully
 */
router.get('/trends', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const trends = await getPizzaTrends(limit);

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get pizza trends');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pizza trends',
    });
  }
});

/**
 * @swagger
 * /api/analytics/participation:
 *   get:
 *     summary: Get participation statistics over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recent events to analyze
 *     responses:
 *       200:
 *         description: Participation stats retrieved successfully
 */
router.get('/participation', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const stats = await getParticipationStats(limit);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get participation stats');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve participation statistics',
    });
  }
});

export default router;
