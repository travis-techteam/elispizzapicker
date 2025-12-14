import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { AuthenticatedRequest } from '../types/index.js';
import { reminderService } from '../services/reminder.service.js';

const router = Router();

// Validation schemas
const createEventSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  deadline: z.string().datetime(),
  isActive: z.boolean().default(false),
  reminderMinutesBefore: z.number().int().min(15).max(1440).optional().nullable(),
});

const updateEventSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  deadline: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  reminderMinutesBefore: z.number().int().min(15).max(1440).optional().nullable(),
});

// Get active event (any authenticated user)
router.get('/active', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const event = await prisma.event.findFirst({
      where: { isActive: true },
      include: {
        createdBy: {
          select: { name: true },
        },
        pizzaOptions: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { votes: true },
        },
      },
    });

    if (!event) {
      res.json({
        success: true,
        data: null,
        message: 'No active event',
      });
      return;
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Get active event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active event',
    });
  }
});

// List all events (any authenticated user)
router.get('/', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        createdBy: {
          select: { name: true },
        },
        _count: {
          select: { votes: true, pizzaOptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('List events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list events',
    });
  }
});

// Get event by ID (any authenticated user)
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: { name: true },
        },
        pizzaOptions: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { votes: true },
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

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event',
    });
  }
});

// Create event (Admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createEventSchema.parse(req.body);

    // If setting this event as active, deactivate others
    if (data.isActive) {
      await prisma.event.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const event = await prisma.event.create({
      data: {
        name: data.name,
        description: data.description,
        deadline: new Date(data.deadline),
        isActive: data.isActive,
        reminderMinutesBefore: data.reminderMinutesBefore,
        createdById: req.user!.userId,
      },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: event,
      message: 'Event created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create event',
    });
  }
});

// Update event (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = updateEventSchema.parse(req.body);

    // Check if event exists
    const existing = await prisma.event.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    // If setting this event as active, deactivate others
    if (data.isActive && !existing.isActive) {
      await prisma.event.updateMany({
        where: {
          isActive: true,
          id: { not: req.params.id },
        },
        data: { isActive: false },
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      ...data,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
    };

    // Reset reminderSentAt if deadline changes to allow new reminder
    if (data.deadline && new Date(data.deadline).getTime() !== existing.deadline.getTime()) {
      updateData.reminderSentAt = null;
    }

    // Also reset reminderSentAt if reminder timing changes
    if (data.reminderMinutesBefore !== undefined && data.reminderMinutesBefore !== existing.reminderMinutesBefore) {
      updateData.reminderSentAt = null;
    }

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        createdBy: {
          select: { name: true },
        },
        pizzaOptions: {
          orderBy: { name: 'asc' },
        },
      },
    });

    res.json({
      success: true,
      data: event,
      message: 'Event updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update event',
    });
  }
});

// Delete event (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if event exists
    const existing = await prisma.event.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    await prisma.event.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete event',
    });
  }
});

// Send reminders manually (Admin only)
router.post('/:id/send-reminders', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
    });

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    if (new Date() > event.deadline) {
      res.status(400).json({
        success: false,
        error: 'Cannot send reminders for a past event',
      });
      return;
    }

    // Reset reminderSentAt to allow re-sending
    await prisma.event.update({
      where: { id: req.params.id },
      data: { reminderSentAt: null },
    });

    // Send reminders
    const result = await reminderService.sendRemindersForEvent(
      event.id,
      event.name,
      event.deadline
    );

    res.json({
      success: true,
      message: `Sent ${result.sent} reminders (${result.failed} failed)`,
      data: result,
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send reminders',
    });
  }
});

export default router;
