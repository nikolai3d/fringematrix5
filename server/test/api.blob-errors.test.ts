import request from 'supertest';
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

// This file exercises the BlobUnavailableError path: the server should surface
// upstream Vercel Blob failures as 503 (or 429 for rate limits) rather than
// generic 500s or empty 200s, so the client can render an actionable error.

const listMock = jest.fn();

jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token';
  const serverModule = await import('../server.ts');
  app = serverModule.default;
});

describe('Blob failure surface', () => {
  it('returns 503 from /api/campaigns/:id/images when Vercel Blob is down', async () => {
    listMock.mockReset();
    listMock.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { name: 'TypeError' }));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const campaignsRes = await request(app).get('/api/campaigns');
    const firstId = campaignsRes.body.campaigns[0].id;

    const res = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Vercel Blob unavailable/i);

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('returns 429 with Retry-After when blob API is rate-limited after retry fails', async () => {
    listMock.mockReset();
    const rateLimitErr = Object.assign(new Error('rate limited'), {
      name: 'BlobServiceRateLimited',
      retryAfter: 1,
    });
    // First call: rate-limited. Retry: also rate-limited.
    listMock.mockRejectedValueOnce(rateLimitErr);
    listMock.mockRejectedValueOnce(rateLimitErr);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/glyphs');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.body.error).toMatch(/rate-limited/i);

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
