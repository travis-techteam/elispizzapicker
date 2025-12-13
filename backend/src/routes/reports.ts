import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { AuthenticatedRequest } from '../types/index.js';
import { reportService } from '../services/report.service.js';

const router = Router();

// Get pizza order report for event (Admin only)
router.get('/:eventId/report', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: {
        _count: {
          select: { votes: true, pizzaOptions: true },
        },
      },
    });

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    // Check if there are any votes
    if (event._count.votes === 0) {
      res.json({
        success: true,
        data: null,
        message: 'No votes have been submitted yet',
      });
      return;
    }

    // Check if there are pizza options
    if (event._count.pizzaOptions === 0) {
      res.json({
        success: true,
        data: null,
        message: 'No pizza options have been added yet',
      });
      return;
    }

    // Generate report
    const report = await reportService.generateReport(req.params.eventId);

    res.json({
      success: true,
      data: {
        event: {
          id: event.id,
          name: event.name,
          deadline: event.deadline,
        },
        ...report,
      },
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
    });
  }
});

export default router;
