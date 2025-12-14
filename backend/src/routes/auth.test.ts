import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from './auth.js';

// Mock dependencies
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    authToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../services/auth.service.js', () => ({
  authService: {
    requestSmsCode: vi.fn(),
    requestMagicLink: vi.fn(),
    verifySmsCode: vi.fn(),
    verifyMagicLink: vi.fn(),
    refreshAccessToken: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { authService } from '../services/auth.service.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/request-code', () => {
    it('should return 400 for invalid phone number', async () => {
      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ phone: '123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid phone number format');
    });

    it('should return 400 if phone is missing', async () => {
      const response = await request(app)
        .post('/api/auth/request-code')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 and send code for valid phone', async () => {
      vi.mocked(authService.requestSmsCode).mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ phone: '5551234567' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification code sent');
      expect(authService.requestSmsCode).toHaveBeenCalledWith('5551234567');
    });

    it('should return 400 if user not found', async () => {
      vi.mocked(authService.requestSmsCode).mockResolvedValue({
        success: false,
        error: 'User not found',
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ phone: '5551234567' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/request-magic-link', () => {
    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/request-magic-link')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should return 200 for valid email', async () => {
      vi.mocked(authService.requestMagicLink).mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/api/auth/request-magic-link')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Magic link sent to your email');
      expect(authService.requestMagicLink).toHaveBeenCalledWith('test@example.com');
    });

    it('should return 400 if user not found', async () => {
      vi.mocked(authService.requestMagicLink).mockResolvedValue({
        success: false,
        error: 'User not found',
      });

      const response = await request(app)
        .post('/api/auth/request-magic-link')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/verify-code', () => {
    it('should return 400 for invalid code format', async () => {
      const response = await request(app)
        .post('/api/auth/verify-code')
        .send({ phone: '5551234567', code: '123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid code', async () => {
      vi.mocked(authService.verifySmsCode).mockResolvedValue({
        success: false,
        error: 'Invalid code',
      });

      const response = await request(app)
        .post('/api/auth/verify-code')
        .send({ phone: '5551234567', code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return tokens for valid code', async () => {
      vi.mocked(authService.verifySmsCode).mockResolvedValue({
        success: true,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user-123', name: 'Test User', role: 'USER' },
      });

      const response = await request(app)
        .post('/api/auth/verify-code')
        .send({ phone: '5551234567', code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe('access-token');
      expect(response.body.data.refreshToken).toBe('refresh-token');
      expect(response.body.data.user.id).toBe('user-123');
    });
  });

  describe('POST /api/auth/verify-magic-link', () => {
    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-magic-link')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid token', async () => {
      vi.mocked(authService.verifyMagicLink).mockResolvedValue({
        success: false,
        error: 'Invalid or expired token',
      });

      const response = await request(app)
        .post('/api/auth/verify-magic-link')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return tokens for valid token', async () => {
      vi.mocked(authService.verifyMagicLink).mockResolvedValue({
        success: true,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user-123', name: 'Test User', role: 'USER' },
      });

      const response = await request(app)
        .post('/api/auth/verify-magic-link')
        .send({ token: 'valid-magic-link-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe('access-token');
      expect(response.body.data.refreshToken).toBe('refresh-token');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid refresh token', async () => {
      vi.mocked(authService.refreshAccessToken).mockResolvedValue({
        success: false,
        error: 'Invalid refresh token',
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return new access token for valid refresh token', async () => {
      vi.mocked(authService.refreshAccessToken).mockResolvedValue({
        success: true,
        accessToken: 'new-access-token',
        user: { id: 'user-123', name: 'Test User', role: 'USER' },
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBe('new-access-token');
    });
  });
});
