import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { AuthenticatedRequest } from '../types/index.js';
import { smsService } from '../services/sms.service.js';
import { emailService } from '../services/email.service.js';
import logger from '../utils/logger.js';
import { getPaginationParams, getSkipTake, createPaginatedResponse } from '../utils/pagination.js';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
  sendInvite: z.boolean().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

// Get current user
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error({ err: error, userId: req.user?.userId }, 'Failed to get current user');
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

// List all users (Admin only)
router.get('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pagination = getPaginationParams(req.query);
    const { skip, take } = getSkipTake(pagination);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      ...createPaginatedResponse(users, total, pagination),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list users');
    res.status(500).json({
      success: false,
      error: 'Failed to list users',
    });
  }
});

// Get user by ID (Admin only)
router.get('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        votes: {
          select: {
            id: true,
            eventId: true,
            sliceCount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error({ err: error, targetUserId: req.params.id }, 'Failed to get user');
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

// Create user (Admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Check if phone already exists
    const existing = await prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        error: 'A user with this phone number already exists',
      });
      return;
    }

    // Get the admin's name for the invite
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    const user = await prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    // Send invite if requested
    if (data.sendInvite && admin) {
      // Try SMS first
      const smsResult = await smsService.sendInvite(data.phone, admin.name);

      // If SMS fails and user has email, try email
      if (!smsResult.success && data.email) {
        await emailService.sendInvite(data.email, admin.name);
      }
    }

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully',
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
    logger.error({ err: error }, 'Failed to create user');
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
    });
  }
});

// Update user (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = updateUserSchema.parse(req.body);

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // If changing phone, check it's not already in use
    if (data.phone && data.phone !== existing.phone) {
      const phoneInUse = await prisma.user.findUnique({
        where: { phone: data.phone },
      });

      if (phoneInUse) {
        res.status(400).json({
          success: false,
          error: 'Phone number already in use',
        });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully',
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
    logger.error({ err: error, targetUserId: req.params.id }, 'Failed to update user');
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Prevent deleting yourself
    if (existing.id === req.user!.userId) {
      res.status(400).json({
        success: false,
        error: 'You cannot delete yourself',
      });
      return;
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error({ err: error, targetUserId: req.params.id }, 'Failed to delete user');
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
    });
  }
});

export default router;
