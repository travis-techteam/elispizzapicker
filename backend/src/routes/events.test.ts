import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock Prisma - must use vi.hoisted to avoid hoisting issues
const mockPrisma = vi.hoisted(() => ({
  event: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../utils/prisma.js', () => ({
  default: mockPrisma,
}));

import eventRoutes from './events.js';

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

vi.mock('../services/reminder.service.js', () => ({
  reminderService: {
    sendRemindersForEvent: vi.fn().mockResolvedValue({ sent: 5, failed: 0 }),
  },
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);

// Helper to create auth token
function createToken(userId: string, role: 'USER' | 'ADMIN' = 'USER') {
  return jwt.sign({ userId, role }, 'test-secret-key', { expiresIn: '1h' });
}

describe('Events Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/events/active', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/events/active');

      expect(response.status).toBe(401);
    });

    it('should return null if no active event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/events/active')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toBe('No active event');
    });

    it('should return active event', async () => {
      const activeEvent = {
        id: 'event-123',
        name: 'Friday Pizza',
        description: 'Weekly pizza order',
        deadline: new Date('2025-12-20T17:00:00Z'),
        isActive: true,
        createdBy: { name: 'Admin User' },
        pizzaOptions: [{ id: 'pizza-1', name: 'Pepperoni' }],
        _count: { votes: 5 },
      };
      mockPrisma.event.findFirst.mockResolvedValue(activeEvent);

      const response = await request(app)
        .get('/api/events/active')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('event-123');
      expect(response.body.data.name).toBe('Friday Pizza');
    });
  });

  describe('GET /api/events', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/events');

      expect(response.status).toBe(401);
    });

    it('should return paginated events', async () => {
      const events = [
        { id: 'event-1', name: 'Event 1', createdBy: { name: 'Admin' }, _count: { votes: 3, pizzaOptions: 5 } },
        { id: 'event-2', name: 'Event 2', createdBy: { name: 'Admin' }, _count: { votes: 7, pizzaOptions: 4 } },
      ];
      mockPrisma.event.findMany.mockResolvedValue(events);
      mockPrisma.event.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should respect pagination parameters', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(50);

      const response = await request(app)
        .get('/api/events?page=2&limit=10')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(200);
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('GET /api/events/:id', () => {
    it('should return 404 if event not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/events/nonexistent-id')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event not found');
    });

    it('should return event by id', async () => {
      const event = {
        id: 'event-123',
        name: 'Test Event',
        createdBy: { name: 'Admin' },
        pizzaOptions: [],
        _count: { votes: 0 },
      };
      mockPrisma.event.findUnique.mockResolvedValue(event);

      const response = await request(app)
        .get('/api/events/event-123')
        .set('Authorization', `Bearer ${createToken('user-123')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('event-123');
    });
  });

  describe('POST /api/events', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ name: 'Test Event', deadline: '2025-12-20T17:00:00Z' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`)
        .send({ name: 'Test Event', deadline: '2025-12-20T17:00:00Z' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: '', deadline: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should create event for admin users', async () => {
      const newEvent = {
        id: 'new-event-123',
        name: 'New Event',
        description: 'Description',
        deadline: new Date('2025-12-20T17:00:00Z'),
        isActive: false,
        createdBy: { name: 'Admin' },
      };
      mockPrisma.event.create.mockResolvedValue(newEvent);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({
          name: 'New Event',
          description: 'Description',
          deadline: '2025-12-20T17:00:00Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('new-event-123');
    });

    it('should deactivate other events when creating active event', async () => {
      mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.event.create.mockResolvedValue({
        id: 'new-event',
        name: 'Active Event',
        isActive: true,
        createdBy: { name: 'Admin' },
      });

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({
          name: 'Active Event',
          deadline: '2025-12-20T17:00:00Z',
          isActive: true,
        });

      expect(response.status).toBe(201);
      expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
    });
  });

  describe('PUT /api/events/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .put('/api/events/event-123')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`)
        .send({ name: 'Updated Event' });

      expect(response.status).toBe(403);
    });

    it('should return 404 if event not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/events/nonexistent')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: 'Updated Event' });

      expect(response.status).toBe(404);
    });

    it('should update event for admin users', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-123',
        name: 'Original',
        isActive: false,
        deadline: new Date(),
      });
      mockPrisma.event.update.mockResolvedValue({
        id: 'event-123',
        name: 'Updated Event',
        createdBy: { name: 'Admin' },
        pizzaOptions: [],
      });

      const response = await request(app)
        .put('/api/events/event-123')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`)
        .send({ name: 'Updated Event' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/events/event-123')
        .set('Authorization', `Bearer ${createToken('user-123', 'USER')}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 if event not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/events/nonexistent')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(404);
    });

    it('should delete event for admin users', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-123' });
      mockPrisma.event.delete.mockResolvedValue({ id: 'event-123' });

      const response = await request(app)
        .delete('/api/events/event-123')
        .set('Authorization', `Bearer ${createToken('admin-123', 'ADMIN')}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event deleted successfully');
    });
  });
});
