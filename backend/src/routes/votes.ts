import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Validation schema
const voteSchema = z.object({
  sliceCount: z.number().int().min(1).max(20),
  choices: z
    .array(
      z.object({
        pizzaOptionId: z.string().min(1),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      })
    )
    .length(3)
    .refine(
      (choices) => {
        const priorities = choices.map((c) => c.priority);
        return priorities.includes(1) && priorities.includes(2) && priorities.includes(3);
      },
      { message: 'Must have exactly one choice for each priority (1, 2, 3)' }
    )
    .refine(
      (choices) => {
        const ids = choices.map((c) => c.pizzaOptionId);
        return new Set(ids).size === ids.length;
      },
      { message: 'Cannot vote for the same pizza option multiple times' }
    ),
});

// Get all votes for event (visible to all authenticated users)
router.get('/:eventId/votes', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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

    const votes = await prisma.vote.findMany({
      where: { eventId: req.params.eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        choices: {
          include: {
            pizzaOption: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: votes,
    });
  } catch (error) {
    console.error('Get votes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get votes',
    });
  }
});

// Get current user's vote for event
router.get('/:eventId/votes/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const vote = await prisma.vote.findUnique({
      where: {
        userId_eventId: {
          userId: req.user!.userId,
          eventId: req.params.eventId,
        },
      },
      include: {
        choices: {
          include: {
            pizzaOption: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!vote) {
      res.json({
        success: true,
        data: null,
        message: 'You have not voted yet',
      });
      return;
    }

    res.json({
      success: true,
      data: vote,
    });
  } catch (error) {
    console.error('Get my vote error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get vote',
    });
  }
});

// Submit or update vote
router.post('/:eventId/votes', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = voteSchema.parse(req.body);

    // Check if event exists and is active
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

    // Check if deadline has passed
    if (new Date() > event.deadline) {
      res.status(400).json({
        success: false,
        error: 'Voting deadline has passed',
      });
      return;
    }

    // Verify all pizza options exist and belong to this event
    const pizzaIds = data.choices.map((c) => c.pizzaOptionId);
    const pizzas = await prisma.pizzaOption.findMany({
      where: {
        id: { in: pizzaIds },
        eventId: req.params.eventId,
      },
    });

    if (pizzas.length !== pizzaIds.length) {
      res.status(400).json({
        success: false,
        error: 'One or more pizza options are invalid',
      });
      return;
    }

    // Check if user already has a vote for this event
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_eventId: {
          userId: req.user!.userId,
          eventId: req.params.eventId,
        },
      },
    });

    let vote;

    if (existingVote) {
      // Update existing vote
      // First, delete old choices
      await prisma.voteChoice.deleteMany({
        where: { voteId: existingVote.id },
      });

      // Update vote and create new choices
      vote = await prisma.vote.update({
        where: { id: existingVote.id },
        data: {
          sliceCount: data.sliceCount,
          choices: {
            create: data.choices.map((choice) => ({
              pizzaOptionId: choice.pizzaOptionId,
              priority: choice.priority,
            })),
          },
        },
        include: {
          choices: {
            include: {
              pizzaOption: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { priority: 'asc' },
          },
        },
      });

      res.json({
        success: true,
        data: vote,
        message: 'Vote updated successfully',
      });
    } else {
      // Create new vote
      vote = await prisma.vote.create({
        data: {
          userId: req.user!.userId,
          eventId: req.params.eventId,
          sliceCount: data.sliceCount,
          choices: {
            create: data.choices.map((choice) => ({
              pizzaOptionId: choice.pizzaOptionId,
              priority: choice.priority,
            })),
          },
        },
        include: {
          choices: {
            include: {
              pizzaOption: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { priority: 'asc' },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: vote,
        message: 'Vote submitted successfully',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Submit vote error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit vote',
    });
  }
});

// Delete my vote
router.delete('/:eventId/votes/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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

    // Check if deadline has passed
    if (new Date() > event.deadline) {
      res.status(400).json({
        success: false,
        error: 'Voting deadline has passed',
      });
      return;
    }

    // Check if vote exists
    const vote = await prisma.vote.findUnique({
      where: {
        userId_eventId: {
          userId: req.user!.userId,
          eventId: req.params.eventId,
        },
      },
    });

    if (!vote) {
      res.status(404).json({
        success: false,
        error: 'Vote not found',
      });
      return;
    }

    await prisma.vote.delete({
      where: { id: vote.id },
    });

    res.json({
      success: true,
      message: 'Vote removed successfully',
    });
  } catch (error) {
    console.error('Delete vote error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vote',
    });
  }
});

export default router;
