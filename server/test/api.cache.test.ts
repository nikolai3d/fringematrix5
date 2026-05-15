import request from 'supertest';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// Test coverage for listBlobsWithCache:
//   1. Cache hit: cached results returned within TTL (no second blob API call)
//   2. TTL expiry: re-fetches after TTL elapses
//   3. LRU eviction: 101st unique key evicts the oldest entry

const listMock = jest.fn();

jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;
let blobCache: Map<string, { data: any; timestamp: number }>;
let CACHE_TTL: number;
let BLOB_CACHE_MAX: number;

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token';
  const serverModule = await import('../server.ts');
  app = serverModule.default;
  blobCache = (serverModule as any).blobCache;
  CACHE_TTL = (serverModule as any).CACHE_TTL;
  BLOB_CACHE_MAX = (serverModule as any).BLOB_CACHE_MAX;
});

beforeEach(() => {
  blobCache.clear();
  listMock.mockReset();
  jest.useRealTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('blob cache TTL and LRU eviction', () => {
  describe('cache hit within TTL', () => {
    it('returns cached results on second request without calling list again', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const fakeBlobs = [
        {
          pathname: 'avatars/_images/Glyphs/small/g1.png',
          url: 'https://cdn/g1.png',
          size: 100,
        },
      ];
      listMock.mockResolvedValue({ blobs: fakeBlobs });

      // First request: populates the cache
      const res1 = await request(app).get('/api/glyphs');
      expect(res1.status).toBe(200);
      expect(res1.body.glyphs).toEqual(['https://cdn/g1.png']);
      expect(listMock).toHaveBeenCalledTimes(1);

      // Second request within TTL: must NOT call list again
      const res2 = await request(app).get('/api/glyphs');
      expect(res2.status).toBe(200);
      expect(res2.body.glyphs).toEqual(['https://cdn/g1.png']);
      expect(listMock).toHaveBeenCalledTimes(1); // still only 1 call

      consoleSpy.mockRestore();
    });
  });

  describe('cache expiry after TTL', () => {
    it('re-fetches from blob API after TTL has elapsed', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      jest.useFakeTimers();

      const firstBlobs = [
        {
          pathname: 'avatars/_images/Glyphs/small/g1.png',
          url: 'https://cdn/g1.png',
          size: 100,
        },
      ];
      const secondBlobs = [
        {
          pathname: 'avatars/_images/Glyphs/small/g2.png',
          url: 'https://cdn/g2.png',
          size: 200,
        },
      ];
      listMock.mockResolvedValueOnce({ blobs: firstBlobs });
      listMock.mockResolvedValueOnce({ blobs: secondBlobs });

      // First request at t=0
      const res1 = await request(app).get('/api/glyphs');
      expect(res1.status).toBe(200);
      expect(res1.body.glyphs).toEqual(['https://cdn/g1.png']);
      expect(listMock).toHaveBeenCalledTimes(1);

      // Advance time past the TTL
      jest.advanceTimersByTime(CACHE_TTL + 1);

      // Second request after TTL: must re-fetch
      const res2 = await request(app).get('/api/glyphs');
      expect(res2.status).toBe(200);
      expect(res2.body.glyphs).toEqual(['https://cdn/g2.png']);
      expect(listMock).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('LRU eviction at max capacity', () => {
    it('evicts the oldest entry when 101st unique key is inserted', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Resolve every list call with an empty blob list
      listMock.mockResolvedValue({ blobs: [] });

      // Fill the cache with BLOB_CACHE_MAX (100) unique entries by requesting
      // 100 distinct avatar paths. Each /avatars/<path> request calls
      // listBlobsWithCache with a unique prefix option.
      for (let i = 0; i < BLOB_CACHE_MAX; i++) {
        await request(app).get(`/avatars/campaign-${i}/image.png`);
      }

      expect(blobCache.size).toBe(BLOB_CACHE_MAX);

      // The first key inserted corresponds to campaign-0
      const firstKey = JSON.stringify({ prefix: 'avatars/campaign-0/image.png', limit: 1 });
      expect(blobCache.has(firstKey)).toBe(true);

      // Insert the 101st unique entry — should evict the oldest (campaign-0)
      await request(app).get('/avatars/campaign-evict/image.png');

      expect(blobCache.size).toBe(BLOB_CACHE_MAX);
      expect(blobCache.has(firstKey)).toBe(false);

      // The newly inserted key must be present
      const newKey = JSON.stringify({ prefix: 'avatars/campaign-evict/image.png', limit: 1 });
      expect(blobCache.has(newKey)).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
