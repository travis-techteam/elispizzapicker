import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Get application metrics
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: Application metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const [userCount, eventCount, voteCount, activeEvent] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.vote.count(),
      prisma.event.findFirst({ where: { isActive: true } }),
    ]);

    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        users: {
          total: userCount,
        },
        events: {
          total: eventCount,
          hasActive: !!activeEvent,
          activeEventId: activeEvent?.id || null,
        },
        votes: {
          total: voteCount,
        },
        server: {
          uptime: Math.floor(process.uptime()),
          uptimeHuman: formatUptime(process.uptime()),
          memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            unit: 'MB',
          },
          nodeVersion: process.version,
          platform: process.platform,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get metrics');
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
    });
  }
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

export default router;
