import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';

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

// Request SMS code
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
    console.error('Request code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code',
    });
  }
});

// Request magic link
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
    console.error('Request magic link error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send magic link',
    });
  }
});

// Verify SMS code
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
    console.error('Verify code error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

// Verify magic link
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
    console.error('Verify magic link error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

// Refresh token
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
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
    });
  }
});

export default router;
