import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock Prisma - must use vi.hoisted to avoid hoisting issues
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../utils/prisma.js', () => ({
  default: mockPrisma,
}));

import userRoutes from './users.js';

vi.mock('../config/index.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
    },
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

vi.mock('../services/sms.service.js', () => ({
  smsService: {
    sendInvite: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../services/email.service.js', () => ({
  emailService: {
    sendInvite: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

// Helper to create auth token
function createToken(userId: string, role: 'USER' | 'ADMIN' = 'USER') {
  return jwt.sign({ userId, role }, 'test-secret-key', { expiresIn: '1h' });
}

describe('Users Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return current user data', async () => {
      const user = {
        id: 'user-123',
        name: 'Test User',
        phone: '5551234567',
        email: 'test@example.com',
        role: 'USER',
        lastLoginAt: new Date(),
        createdAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-123');
      expect(response.body.data.name).toBe('Test User');
    });
  });

  describe('GET /api/users', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should return paginated users for admin', async () => {
      const users = [
        { id: 'user-1', name: 'User 1', phone: '5551111111', role: 'USER' },
        { id: 'user-2', name: 'User 2', phone: '5552222222', role: 'USER' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/users/target-user')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/nonexistent')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(404);
    });

    it('should return user with votes for admin', async () => {
      const user = {
        id: 'target-user',
        name: 'Target User',
        phone: '5551234567',
        role: 'USER',
        votes: [{ id: 'vote-1', eventId: 'event-1', sliceCount: 3 }],
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const response = await request(app)
        .get('/api/users/target-user')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('target-user');
      expect(response.body.data.votes).toHaveLength(1);
    });
  });

  describe('POST /api/users', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`)
        .send({ name: 'New User', phone: '5551234567' });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: '', phone: '123' });

      expect(response.status).toBe(400);
    });

    it('should return 400 if phone already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: 'New User', phone: '5551234567' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('A user with this phone number already exists');
    });

    it('should create user for admin', async () => {
      // First call for existing check (null), second for admin user lookup
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // phone check
        .mockResolvedValueOnce({ id: 'admin-123', name: 'Admin' }); // admin lookup

      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        name: 'New User',
        phone: '5551234567',
        role: 'USER',
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: 'New User', phone: '5551234567' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New User');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .put('/api/users/target-user')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(403);
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/users/nonexistent')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
    });

    it('should return 400 if new phone is already in use', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'target-user', phone: '5551111111' }) // existing user
        .mockResolvedValueOnce({ id: 'other-user' }); // phone check

      const response = await request(app)
        .put('/api/users/target-user')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ phone: '5552222222' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Phone number already in use');
    });

    it('should update user for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-user',
        name: 'Original Name',
        phone: '5551234567',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'target-user',
        name: 'Updated Name',
        phone: '5551234567',
        role: 'USER',
      });

      const response = await request(app)
        .put('/api/users/target-user')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/users/target-user')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/users/nonexistent')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(404);
    });

    it('should prevent deleting yourself', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-123',
        name: 'Admin',
      });

      const response = await request(app)
        .delete('/api/users/admin-123')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('You cannot delete yourself');
    });

    it('should delete user for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-user',
        name: 'Target User',
      });
      mockPrisma.user.delete.mockResolvedValue({ id: 'target-user' });

      const response = await request(app)
        .delete('/api/users/target-user')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User deleted successfully');
    });
  });
});
