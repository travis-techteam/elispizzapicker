import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import logger from '../utils/logger.js';

const router = Router();

// Validation schemas
const requestCodeSchema = z.object({
  phone: z.string().min(10).max(15),
});

const requestMagicLinkSchema = z.object({
  email: z.string().email(),
});

const verifySmsSchema = z.object({
  phone: z.string().min(10).max(15),
  code: z.string().length(6),
});

const verifyMagicLinkSchema = z.object({
  token: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/**
 * @swagger
 * /api/auth/request-code:
 *   post:
 *     summary: Request SMS verification code
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number (10-15 digits)
 *                 example: "5551234567"
 *     responses:
 *       200:
 *         description: Verification code sent
 *       400:
 *         description: Invalid phone number or user not found
 *       500:
 *         description: Server error
 */
router.post('/request-code', async (req: Request, res: Response) => {
  try {
    const { phone } = requestCodeSchema.parse(req.body);
    const result = await authService.requestSmsCode(phone);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      warning: result.error, // Contains dev mode warning if applicable
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
      });
      return;
    }
    logger.error({ err: error }, 'Failed to request code');
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code',
    });
  }
});

/**
 * @swagger
 * /api/auth/request-magic-link:
 *   post:
 *     summary: Request email magic link
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Magic link sent
 *       400:
 *         description: Invalid email or user not found
 *       500:
 *         description: Server error
 */
router.post('/request-magic-link', async (req: Request, res: Response) => {
  try {
    const { email } = requestMagicLinkSchema.parse(req.body);
    const result = await authService.requestMagicLink(email);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: 'Magic link sent to your email',
      warning: result.error, // Contains dev mode warning if applicable
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
      return;
    }
    logger.error({ err: error }, 'Failed to request magic link');
    res.status(500).json({
      success: false,
      error: 'Failed to send magic link',
    });
  }
});

/**
 * @swagger
 * /api/auth/verify-code:
 *   post:
 *     summary: Verify SMS code and get tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone:
 *                 type: string
 *               code:
 *                 type: string
 *                 description: 6-digit verification code
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         description: Invalid code
 *       500:
 *         description: Server error
 */
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { phone, code } = verifySmsSchema.parse(req.body);
    const result = await authService.verifySmsCode(phone, code);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    // Wrap in data property for frontend ApiResponse format
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input format',
      });
      return;
    }
    logger.error({ err: error }, 'Failed to verify code');
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

/**
 * @swagger
 * /api/auth/verify-magic-link:
 *   post:
 *     summary: Verify magic link token and get tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Server error
 */
router.post('/verify-magic-link', async (req: Request, res: Response) => {
  try {
    const { token } = verifyMagicLinkSchema.parse(req.body);
    const result = await authService.verifyMagicLink(token);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    // Wrap in data property for frontend ApiResponse format
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid token format',
      });
      return;
    }
    logger.error({ err: error }, 'Failed to verify magic link');
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Server error
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      res.status(401).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid token format',
      });
      return;
    }
    logger.error({ err: error }, 'Failed to refresh token');
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
    });
  }
});

export default router;
