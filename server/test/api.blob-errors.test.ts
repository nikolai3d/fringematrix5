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

  it('returns 503 (not 429) when rate-limit retry hits a non-rate-limit error', async () => {
    listMock.mockReset();
    const rateLimitErr = Object.assign(new Error('rate limited'), {
      name: 'BlobServiceRateLimited',
      retryAfter: 1,
    });
    const connectErr = Object.assign(new Error('connect ECONNREFUSED'), { name: 'TypeError' });
    // First call: rate-limited. Retry: connection error (not rate-limit).
    // Should surface as 503 without Retry-After, since we have no meaningful hint.
    listMock.mockRejectedValueOnce(rateLimitErr);
    listMock.mockRejectedValueOnce(connectErr);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/glyphs');
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBeUndefined();
    expect(res.body.error).toMatch(/after retry/i);

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('caches the retry result when first call is rate-limited but retry succeeds', async () => {
    listMock.mockReset();
    const rateLimitErr = Object.assign(new Error('rate limited'), {
      name: 'BlobServiceRateLimited',
      retryAfter: 1,
    });
    // First call rate-limited; retry succeeds; subsequent calls should hit
    // the cache so listMock is called exactly twice total across two requests.
    listMock.mockRejectedValueOnce(rateLimitErr);
    listMock.mockResolvedValueOnce({ blobs: [{ pathname: 'avatars/_images/Glyphs/small/g.png', url: 'https://cdn/g.png', size: 1 }] });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const first = await request(app).get('/api/glyphs');
    expect(first.status).toBe(200);
    expect(first.body.glyphs).toEqual(['https://cdn/g.png']);

    const second = await request(app).get('/api/glyphs');
    expect(second.status).toBe(200);
    expect(second.body.glyphs).toEqual(['https://cdn/g.png']);

    expect(listMock).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
