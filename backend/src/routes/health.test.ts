import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';

// Mock Prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

describe('Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/health should return success when database is connected', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database).toBe('ok');
    expect(response.body.uptime).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /api/health should return degraded status when database fails', async () => {
    // Import the mocked module and override for this test
    const prisma = await import('../utils/prisma.js');
    vi.mocked(prisma.default.$queryRaw).mockRejectedValueOnce(new Error('Database error'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.database).toBe('error');
  });

  it('GET /api/nonexistent should return 404', async () => {
    const response = await request(app).get('/api/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: 'Endpoint not found',
    });
  });
});
