import request from 'supertest';
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// Verifies that listBlobsWithCache pages through all results rather than
// truncating at limit: 1000.  The @vercel/blob list() API returns
// { blobs, hasMore, cursor } and this test drives the pagination loop.

const listMock = jest.fn();

jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;
let blobCache: Map<string, { data: any; timestamp: number }>;
let MAX_BLOB_ITEMS: number;

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token';
  const serverModule = await import('../server.ts');
  app = serverModule.default;
  blobCache = (serverModule as any).blobCache;
  MAX_BLOB_ITEMS = (serverModule as any).MAX_BLOB_ITEMS;
});

beforeEach(() => {
  blobCache.clear();
  listMock.mockReset();
});

// Build a fake blob with a unique pathname and URL.
function makeBlob(name: string) {
  const iconPath = 'testcampaign';
  return {
    pathname: `avatars/${iconPath}/${name}.png`,
    url: `https://cdn/${name}.png`,
    size: 100,
    downloadUrl: `https://cdn/${name}.png?download=1`,
    uploadedAt: new Date().toISOString(),
  };
}

describe('blob cursor pagination', () => {
  it('makes a single list() call when hasMore is false', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const blobs = [makeBlob('a'), makeBlob('b')];
    listMock.mockResolvedValueOnce({ blobs, hasMore: false });

    const campaignsRes = await request(app).get('/api/campaigns');
    const firstId = campaignsRes.body.campaigns[0].id;

    const res = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res.status).toBe(200);
    // list() should be called exactly once (no next page)
    expect(listMock).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('follows cursor pages and merges all blobs', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Simulate two pages of results
    const page1 = [makeBlob('img-1'), makeBlob('img-2'), makeBlob('img-3')];
    const page2 = [makeBlob('img-4'), makeBlob('img-5')];

    listMock
      .mockResolvedValueOnce({ blobs: page1, hasMore: true, cursor: 'cursor-abc' })
      .mockResolvedValueOnce({ blobs: page2, hasMore: false });

    const campaignsRes = await request(app).get('/api/campaigns');
    const firstId = campaignsRes.body.campaigns[0].id;

    const res = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res.status).toBe(200);
    // Both pages should have been fetched
    expect(listMock).toHaveBeenCalledTimes(2);
    // The cursor from page 1 must be passed to the second call
    expect(listMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'cursor-abc' }));
    // All 5 images from both pages should appear in the response
    expect(res.body.images).toHaveLength(5);

    consoleSpy.mockRestore();
  });

  it('handles three or more pages and accumulates all blobs', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    listMock
      .mockResolvedValueOnce({ blobs: [makeBlob('p1')], hasMore: true, cursor: 'cur-1' })
      .mockResolvedValueOnce({ blobs: [makeBlob('p2')], hasMore: true, cursor: 'cur-2' })
      .mockResolvedValueOnce({ blobs: [makeBlob('p3')], hasMore: false });

    const campaignsRes = await request(app).get('/api/campaigns');
    const firstId = campaignsRes.body.campaigns[0].id;

    const res = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledTimes(3);
    expect(res.body.images).toHaveLength(3);

    consoleSpy.mockRestore();
  });

  it('caches the merged multi-page result and does not re-fetch on second request', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const page1 = [makeBlob('cached-1'), makeBlob('cached-2')];
    const page2 = [makeBlob('cached-3')];

    listMock
      .mockResolvedValueOnce({ blobs: page1, hasMore: true, cursor: 'c1' })
      .mockResolvedValueOnce({ blobs: page2, hasMore: false });

    const campaignsRes = await request(app).get('/api/campaigns');
    const firstId = campaignsRes.body.campaigns[0].id;

    // First request: should fetch both pages (2 list() calls)
    const res1 = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res1.status).toBe(200);
    expect(res1.body.images).toHaveLength(3);
    expect(listMock).toHaveBeenCalledTimes(2);

    // Second request within TTL: should come entirely from cache (no extra list() calls)
    const res2 = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res2.status).toBe(200);
    expect(res2.body.images).toHaveLength(3);
    expect(listMock).toHaveBeenCalledTimes(2); // still only 2 calls total

    consoleSpy.mockRestore();
  });
});
