import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('JWT_SECRET validation', () => {
    it('should throw error in production when JWT_SECRET is not set', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      await expect(async () => {
        await import('./index.js');
      }).rejects.toThrow('JWT_SECRET environment variable is required in production');
    });

    it('should use default secret in development when JWT_SECRET is not set', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      const { config } = await import('./index.js');
      expect(config.jwt.secret).toBe('dev-secret-change-me');
    });

    it('should use provided JWT_SECRET in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'my-production-secret';

      const { config } = await import('./index.js');
      expect(config.jwt.secret).toBe('my-production-secret');
    });
  });

  describe('isProduction flag', () => {
    it('should be true when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-secret';

      const { config } = await import('./index.js');
      expect(config.isProduction).toBe(true);
    });

    it('should be false when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';

      const { config } = await import('./index.js');
      expect(config.isProduction).toBe(false);
    });
  });
});
