import request from 'supertest';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Edge-case coverage for listBlobsWithCache and the blob-backed routes:
//   - MAX_BLOB_ITEMS truncation + warning in the pagination loop
//   - rate limit served from an EXPIRED cache entry
//   - rate-limit retry on the paginated (campaign images) path
//   - retry-after fallback when the retry error carries no hint
//   - non-Error rejection values
//   - /avatars/* nested + URL-encoded paths, non-blob errors -> 500, 429
//   - /api/glyphs non-image filtering and non-blob errors -> 500
// retryAfter is always 0 in rate-limit fixtures so no real sleeping occurs.
// ---------------------------------------------------------------------------

const listMock = jest.fn<(opts?: any) => Promise<unknown>>();

jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;
let blobCache: Map<string, { data: any; timestamp: number }>;
let MAX_BLOB_ITEMS: number;
let CACHE_TTL: number;
let firstCampaignId: string;

function rateLimited(retryAfter?: number): Error {
  return Object.assign(new Error('rate limited'), {
    name: 'BlobServiceRateLimited',
    ...(retryAfter !== undefined ? { retryAfter } : {}),
  });
}

let errSpy: ReturnType<typeof jest.spyOn>;
let logSpy: ReturnType<typeof jest.spyOn>;
let warnSpy: ReturnType<typeof jest.spyOn>;

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token-blob-edge';
  const l = jest.spyOn(console, 'log').mockImplementation(() => {});
  const serverModule = await import('../server.ts');
  l.mockRestore();
  app = serverModule.default;
  blobCache = (serverModule as any).blobCache;
  MAX_BLOB_ITEMS = (serverModule as any).MAX_BLOB_ITEMS;
  CACHE_TTL = (serverModule as any).CACHE_TTL;
  const res = await request(app).get('/api/campaigns');
  firstCampaignId = res.body.campaigns[0].id;
});

beforeEach(() => {
  blobCache.clear();
  listMock.mockReset();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('listBlobsWithCache — pagination cap', () => {
  it('stops paging at MAX_BLOB_ITEMS and warns, even when hasMore is still true', async () => {
    let page = 0;
    listMock.mockImplementation(async () => {
      const n = page++;
      return {
        blobs: Array.from({ length: 1000 }, (_, i) => ({
          pathname: `avatars/cap/p${n}-${i}.png`,
          url: `https://cdn/p${n}-${i}.png`,
          size: 1,
        })),
        hasMore: true,
        cursor: `cur-${n}`,
      };
    });

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledTimes(MAX_BLOB_ITEMS / 1000);
    expect(res.body.images).toHaveLength(MAX_BLOB_ITEMS);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/reached MAX_BLOB_ITEMS \(10000\)/));
  });

  it('does not warn when the final page lands under the cap', async () => {
    listMock.mockResolvedValueOnce({
      blobs: [{ pathname: 'avatars/x/a.png', url: 'https://cdn/a.png', size: 1 }],
      hasMore: false,
    });
    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('stops when hasMore is true but no cursor is returned (defensive loop exit)', async () => {
    listMock.mockResolvedValueOnce({
      blobs: [{ pathname: 'avatars/x/a.png', url: 'https://cdn/a.png', size: 1 }],
      hasMore: true,
      cursor: undefined,
    });
    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(res.body.images).toHaveLength(1);
  });
});

describe('listBlobsWithCache — rate limiting', () => {
  it('serves an expired cache entry instead of failing when rate-limited', async () => {
    listMock.mockResolvedValueOnce({
      blobs: [{ pathname: 'avatars/_images/Glyphs/small/old.png', url: 'https://cdn/old.png', size: 1 }],
    });
    const first = await request(app).get('/api/glyphs');
    expect(first.body.glyphs).toEqual(['https://cdn/old.png']);

    // Age every cache entry past the TTL.
    for (const entry of blobCache.values()) entry.timestamp = Date.now() - CACHE_TTL - 1;

    listMock.mockRejectedValueOnce(rateLimited(0));
    const second = await request(app).get('/api/glyphs');
    expect(second.status).toBe(200);
    expect(second.body.glyphs).toEqual(['https://cdn/old.png']);
    // Exactly one extra call: no retry when a stale fallback exists.
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith('Using expired cache due to rate limit');
  });

  it('does NOT serve an expired cache entry for a non-rate-limit failure (503)', async () => {
    listMock.mockResolvedValueOnce({
      blobs: [{ pathname: 'avatars/_images/Glyphs/small/old.png', url: 'https://cdn/old.png', size: 1 }],
    });
    await request(app).get('/api/glyphs');
    for (const entry of blobCache.values()) entry.timestamp = Date.now() - CACHE_TTL - 1;

    listMock.mockRejectedValueOnce(new Error('socket hang up'));
    const res = await request(app).get('/api/glyphs');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Vercel Blob unavailable: socket hang up');
  });

  it('retries the paginated fetch after a rate limit and caches the result', async () => {
    listMock
      .mockRejectedValueOnce(rateLimited(0))
      .mockResolvedValueOnce({
        blobs: [{ pathname: 'avatars/x/p1.png', url: 'https://cdn/p1.png', size: 1 }],
        hasMore: true,
        cursor: 'c1',
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: 'avatars/x/p2.png', url: 'https://cdn/p2.png', size: 1 }],
        hasMore: false,
      });

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);
    expect(res.body.images.map((i: any) => i.fileName)).toEqual(['p1.png', 'p2.png']);
    expect(listMock).toHaveBeenCalledTimes(3);

    const again = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(again.body.images).toHaveLength(2);
    expect(listMock).toHaveBeenCalledTimes(3);
  });

  it('uses the retry error\'s own retryAfter for the Retry-After header when present', async () => {
    listMock.mockRejectedValueOnce(rateLimited(0)).mockRejectedValueOnce(rateLimited(42));
    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('42');
    expect(res.body).toEqual({ error: 'Vercel Blob is rate-limited' });
  });

  it('falls back to the original (capped) retryAfter when the retry error has none', async () => {
    listMock.mockRejectedValueOnce(rateLimited(0)).mockRejectedValueOnce(rateLimited());
    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('0');
  });

  it('stringifies non-Error rejection values in the 503 message', async () => {
    listMock.mockRejectedValueOnce('plain string failure');
    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Vercel Blob unavailable: plain string failure');
  });

  it('stringifies non-Error retry failures in the after-retry 503 message', async () => {
    listMock.mockRejectedValueOnce(rateLimited(0)).mockRejectedValueOnce({ toString: () => 'weird object' });
    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBeUndefined();
    expect(res.body.error).toBe('Vercel Blob unavailable after retry: weird object');
  });
});

describe('/avatars/* — edge cases', () => {
  it('redirects deeply nested paths and asks list() for the exact prefix with limit 1', async () => {
    const pathname = 'avatars/Season4/CrossTheLine/artist-folder/sub/deep.png';
    listMock.mockResolvedValueOnce({ blobs: [{ pathname, url: 'https://cdn/deep.png', size: 1 }] });
    const res = await request(app).get('/avatars/Season4/CrossTheLine/artist-folder/sub/deep.png');
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('https://cdn/deep.png');
    expect(listMock).toHaveBeenCalledWith({ prefix: pathname, limit: 1 });
  });

  it('decodes URL-encoded spaces and parentheses before matching the blob pathname', async () => {
    const pathname = 'avatars/Season 4/Cross The Line/my avatar (1).png';
    listMock.mockResolvedValueOnce({ blobs: [{ pathname, url: 'https://cdn/encoded.png', size: 1 }] });
    const res = await request(app).get('/avatars/Season%204/Cross%20The%20Line/my%20avatar%20%281%29.png');
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('https://cdn/encoded.png');
    expect(listMock).toHaveBeenCalledWith({ prefix: pathname, limit: 1 });
  });

  it('404s when only a longer-named blob shares the prefix (no exact match)', async () => {
    listMock.mockResolvedValueOnce({
      blobs: [{ pathname: 'avatars/s/a.png.bak', url: 'https://cdn/a.png.bak', size: 1 }],
    });
    const res = await request(app).get('/avatars/s/a.png');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image not found' });
  });

  it('returns 429 with Retry-After when rate-limited on the retry too', async () => {
    listMock.mockRejectedValueOnce(rateLimited(0)).mockRejectedValueOnce(rateLimited(7));
    const res = await request(app).get('/avatars/s/rate-limited.png');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('7');
  });

  it('returns a generic 500 for non-blob failures (malformed list() result)', async () => {
    listMock.mockResolvedValueOnce({ blobs: undefined });
    const res = await request(app).get('/avatars/s/malformed.png');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to serve avatar' });
    expect(errSpy).toHaveBeenCalledWith('Avatar redirect error:', expect.any(TypeError));
  });
});

describe('/api/glyphs — edge cases', () => {
  it('returns only image URLs, dropping non-image blobs', async () => {
    listMock.mockResolvedValueOnce({
      blobs: [
        { pathname: 'avatars/_images/Glyphs/small/a.svg', url: 'https://cdn/a.svg', size: 1 },
        { pathname: 'avatars/_images/Glyphs/small/readme.txt', url: 'https://cdn/readme.txt', size: 1 },
        { pathname: 'avatars/_images/Glyphs/small/b.AVIF', url: 'https://cdn/b.AVIF', size: 1 },
        { pathname: 'avatars/_images/Glyphs/small/noext', url: 'https://cdn/noext', size: 1 },
      ],
    });
    const res = await request(app).get('/api/glyphs');
    expect(res.status).toBe(200);
    expect(res.body.glyphs).toEqual(['https://cdn/a.svg', 'https://cdn/b.AVIF']);
    expect(listMock).toHaveBeenCalledWith({ prefix: 'avatars/_images/Glyphs/small/', limit: 100 });
  });

  it('returns a generic 500 for non-blob failures (malformed list() result)', async () => {
    listMock.mockResolvedValueOnce({});
    const res = await request(app).get('/api/glyphs');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to list glyphs' });
  });
});
