import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { AuthenticatedRequest } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Validation schemas
const createPizzaSchema = z.object({
  name: z.string().min(1).max(100),
  toppings: z.array(z.string().min(1).max(50)).min(0).max(10),
});

const updatePizzaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  toppings: z.array(z.string().min(1).max(50)).min(0).max(10).optional(),
});

// List pizza options for event (any authenticated user)
router.get('/:eventId/pizzas', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
    });

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    const pizzas = await prisma.pizzaOption.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: pizzas,
    });
  } catch (error) {
    logger.error({ err: error, eventId: req.params.eventId }, 'Failed to list pizzas');
    res.status(500).json({
      success: false,
      error: 'Failed to list pizza options',
    });
  }
});

// Get pizza option by ID (any authenticated user)
router.get('/:eventId/pizzas/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pizza = await prisma.pizzaOption.findFirst({
      where: {
        id: req.params.id,
        eventId: req.params.eventId,
      },
    });

    if (!pizza) {
      res.status(404).json({
        success: false,
        error: 'Pizza option not found',
      });
      return;
    }

    res.json({
      success: true,
      data: pizza,
    });
  } catch (error) {
    logger.error({ err: error, eventId: req.params.eventId, pizzaId: req.params.id }, 'Failed to get pizza');
    res.status(500).json({
      success: false,
      error: 'Failed to get pizza option',
    });
  }
});

// Create pizza option (Admin only)
router.post('/:eventId/pizzas', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createPizzaSchema.parse(req.body);

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
    });

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    // Check for duplicate name in this event
    const existing = await prisma.pizzaOption.findFirst({
      where: {
        eventId: req.params.eventId,
        name: data.name,
      },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        error: 'A pizza with this name already exists for this event',
      });
      return;
    }

    const pizza = await prisma.pizzaOption.create({
      data: {
        eventId: req.params.eventId,
        name: data.name,
        toppings: data.toppings,
        toppingCount: data.toppings.length,
      },
    });

    res.status(201).json({
      success: true,
      data: pizza,
      message: 'Pizza option created successfully',
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
    logger.error({ err: error, eventId: req.params.eventId }, 'Failed to create pizza');
    res.status(500).json({
      success: false,
      error: 'Failed to create pizza option',
    });
  }
});

// Update pizza option (Admin only)
router.put('/:eventId/pizzas/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = updatePizzaSchema.parse(req.body);

    // Check if pizza exists for this event
    const existing = await prisma.pizzaOption.findFirst({
      where: {
        id: req.params.id,
        eventId: req.params.eventId,
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Pizza option not found',
      });
      return;
    }

    // If changing name, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.pizzaOption.findFirst({
        where: {
          eventId: req.params.eventId,
          name: data.name,
          id: { not: req.params.id },
        },
      });

      if (duplicate) {
        res.status(400).json({
          success: false,
          error: 'A pizza with this name already exists for this event',
        });
        return;
      }
    }

    const pizza = await prisma.pizzaOption.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        toppings: data.toppings,
        toppingCount: data.toppings ? data.toppings.length : undefined,
      },
    });

    res.json({
      success: true,
      data: pizza,
      message: 'Pizza option updated successfully',
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
    logger.error({ err: error, eventId: req.params.eventId, pizzaId: req.params.id }, 'Failed to update pizza');
    res.status(500).json({
      success: false,
      error: 'Failed to update pizza option',
    });
  }
});

// Delete pizza option (Admin only)
router.delete('/:eventId/pizzas/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if pizza exists for this event
    const existing = await prisma.pizzaOption.findFirst({
      where: {
        id: req.params.id,
        eventId: req.params.eventId,
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Pizza option not found',
      });
      return;
    }

    await prisma.pizzaOption.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Pizza option deleted successfully',
    });
  } catch (error) {
    logger.error({ err: error, eventId: req.params.eventId, pizzaId: req.params.id }, 'Failed to delete pizza');
    res.status(500).json({
      success: false,
      error: 'Failed to delete pizza option',
    });
  }
});

export default router;
