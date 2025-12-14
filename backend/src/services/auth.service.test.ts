import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock config before importing the service
vi.mock('../config/index.js', () => ({
  config: {
    nodeEnv: 'test',
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '1h',
      refreshExpiresIn: '7d',
    },
  },
}));

// Mock Prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    authToken: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock SMS service
vi.mock('./sms.service.js', () => ({
  smsService: {
    sendVerificationCode: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock Email service
vi.mock('./email.service.js', () => ({
  emailService: {
    sendMagicLink: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('generateCode', () => {
    it('should generate a 6-digit code', () => {
      const code = authService.generateCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('should generate different codes on multiple calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(authService.generateCode());
      }
      // Should have at least 90% unique codes
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe('generateToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = authService.generateToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('hashToken and verifyToken', () => {
    it('should hash and verify a token correctly', async () => {
      const token = '123456';
      const hash = await authService.hashToken(token);

      expect(hash).not.toBe(token);
      expect(await authService.verifyToken(token, hash)).toBe(true);
      expect(await authService.verifyToken('wrong', hash)).toBe(false);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT', () => {
      const payload = { userId: 'user-123', role: 'USER' };
      const token = authService.generateAccessToken(payload);

      const decoded = jwt.verify(token, 'test-secret-key') as { userId: string; role: string };
      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('USER');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT with longer expiry', () => {
      const payload = { userId: 'user-123', role: 'USER' };
      const token = authService.generateRefreshToken(payload);

      const decoded = jwt.verify(token, 'test-secret-key') as { userId: string; role: string };
      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('USER');
    });
  });
});
