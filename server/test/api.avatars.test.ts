import request from 'supertest';
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

// This file exercises the /avatars/* redirect route (server.ts:235-267).
// The route lists blobs, looks for an exact path match, and:
//   - 302 redirects to blob.url when found
//   - 404 when no matching blob exists
//   - 503 (or 429) when Vercel Blob is unavailable

const listMock = jest.fn<() => Promise<unknown>>();

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

describe('/avatars/* redirect route', () => {
  it('302 redirects to blob CDN URL when blob is found', async () => {
    listMock.mockReset();
    listMock.mockResolvedValue({
      blobs: [
        {
          pathname: 'avatars/fringematrix5/myavatar.png',
          url: 'https://cdn.example.com/fringematrix5/myavatar.png',
          size: 12345,
        },
      ],
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/avatars/fringematrix5/myavatar.png');

    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe(
      'https://cdn.example.com/fringematrix5/myavatar.png'
    );

    consoleSpy.mockRestore();
  });

  it('returns 404 when no blob matches the requested path', async () => {
    listMock.mockReset();
    // Blob listing returns blobs with a different pathname — no exact match
    listMock.mockResolvedValue({
      blobs: [
        {
          pathname: 'avatars/fringematrix5/other.png',
          url: 'https://cdn.example.com/fringematrix5/other.png',
          size: 999,
        },
      ],
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/avatars/fringematrix5/missing.png');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');

    consoleSpy.mockRestore();
  });

  it('returns 404 when blob listing is empty', async () => {
    listMock.mockReset();
    listMock.mockResolvedValue({ blobs: [] });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/avatars/fringematrix5/nonexistent.png');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');

    consoleSpy.mockRestore();
  });

  it('returns 503 when Vercel Blob is unavailable', async () => {
    listMock.mockReset();
    // Simulate a network/connection failure — the server wraps this in
    // BlobUnavailableError and must respond 503 (not 500).
    // Use a unique path so the server's blob cache from previous tests does
    // not short-circuit the mock and return a cached 302.
    listMock.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED'), { name: 'TypeError' })
    );
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const res = await request(app).get('/avatars/fringematrix5/unavailable-unique-503.png');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Vercel Blob unavailable/i);

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
