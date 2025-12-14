import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('Health Check', () => {
  it('GET /api/health should return success', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'API is running',
    });
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
