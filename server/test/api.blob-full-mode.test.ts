import request from 'supertest';
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Blob full-mode tests: BLOB_READ_WRITE_TOKEN present, list() mocked.
//
// Verifies that GET /api/campaigns/:id/images calls the Vercel Blob list()
// function and returns correctly-shaped results (fileName, src) when a token
// is configured. Also verifies that non-image files are filtered out.
// ---------------------------------------------------------------------------

const listMock = jest.fn<() => Promise<unknown>>();

// Mock must be installed before the server module is imported.
jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;
let blobCache: Map<string, unknown>;
let firstCampaignId: string;
const savedToken = process.env['BLOB_READ_WRITE_TOKEN'];

// Fixture blobs: two valid images + one non-image to exercise the filter.
const FIXTURE_BLOBS = [
  {
    pathname: 'avatars/Season4/CrossTheLine/avatar1.png',
    url: 'https://cdn.example.com/avatars/Season4/CrossTheLine/avatar1.png',
    size: 1024,
  },
  {
    pathname: 'avatars/Season4/CrossTheLine/avatar2.jpg',
    url: 'https://cdn.example.com/avatars/Season4/CrossTheLine/avatar2.jpg',
    size: 2048,
  },
  {
    pathname: 'avatars/Season4/CrossTheLine/readme.txt',
    url: 'https://cdn.example.com/avatars/Season4/CrossTheLine/readme.txt',
    size: 128,
  },
];

beforeAll(async () => {
  // Set token before module loads so HAS_BLOB_TOKEN resolves to true.
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token-full-mode';

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const serverModule = await import('../server.ts');
  app = serverModule.default;
  blobCache = (serverModule as any).blobCache;
  consoleSpy.mockRestore();

  // Resolve the first campaign id from the real campaigns.yaml.
  const campaignsRes = await request(app).get('/api/campaigns');
  firstCampaignId = campaignsRes.body.campaigns[0].id;
});

afterAll(() => {
  // Restore the token to whatever it was before this suite so other test files
  // in the same Jest worker are not affected by the env mutation.
  if (savedToken !== undefined) {
    process.env['BLOB_READ_WRITE_TOKEN'] = savedToken;
  } else {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
  }
  listMock.mockReset();
});

beforeEach(() => {
  // Start each test with a clean cache and a fresh mock state so tests are
  // independent of ordering and don't bleed into each other via the TTL cache.
  blobCache.clear();
  listMock.mockReset();
  listMock.mockResolvedValue({ blobs: FIXTURE_BLOBS, hasMore: false, cursor: undefined });
});

describe('GET /api/campaigns/:id/images — full mode (mocked blob)', () => {
  it('returns 200 with an images array', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('images');
    expect(Array.isArray(res.body.images)).toBe(true);

    consoleSpy.mockRestore();
  });

  it('sets caching headers so the browser/CDN can reuse the list on revisit', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');
    expect(res.headers['vary']).toContain('Accept-Encoding');

    consoleSpy.mockRestore();
  });

  it('calls the Vercel Blob list() function exactly once per cache miss', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(listMock).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('shapes each image entry with non-empty src and fileName fields', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);

    const images: Array<{ src: string; fileName: string }> = res.body.images;
    expect(images.length).toBeGreaterThan(0);

    for (const img of images) {
      expect(typeof img.src).toBe('string');
      expect(img.src.length).toBeGreaterThan(0);
      expect(typeof img.fileName).toBe('string');
      expect(img.fileName.length).toBeGreaterThan(0);
    }

    consoleSpy.mockRestore();
  });

  it('filters out non-image files from blob results', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);

    const images: Array<{ src: string; fileName: string }> = res.body.images;
    // readme.txt must be filtered out; only .png and .jpg survive.
    const fileNames = images.map(img => img.fileName);
    expect(fileNames).not.toContain('readme.txt');
    expect(fileNames).toContain('avatar1.png');
    expect(fileNames).toContain('avatar2.jpg');
    expect(images).toHaveLength(2);

    consoleSpy.mockRestore();
  });

  it('sets fileName to the last path segment of the blob pathname', async () => {
    const singleBlob = [
      {
        pathname: 'avatars/Season4/CrossTheLine/my-avatar.png',
        url: 'https://cdn.example.com/avatars/Season4/CrossTheLine/my-avatar.png',
        size: 500,
      },
    ];
    listMock.mockReset();
    listMock.mockResolvedValue({ blobs: singleBlob, hasMore: false, cursor: undefined });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);

    const images: Array<{ src: string; fileName: string }> = res.body.images;
    expect(images).toHaveLength(1);
    expect(images[0]!.fileName).toBe('my-avatar.png');
    expect(images[0]!.src).toBe('https://cdn.example.com/avatars/Season4/CrossTheLine/my-avatar.png');

    consoleSpy.mockRestore();
  });

  it('sets src to the direct CDN URL from the blob', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);

    const images: Array<{ src: string; fileName: string }> = res.body.images;
    const pngImage = images.find(img => img.fileName === 'avatar1.png');
    expect(pngImage).toBeDefined();
    expect(pngImage!.src).toBe('https://cdn.example.com/avatars/Season4/CrossTheLine/avatar1.png');

    consoleSpy.mockRestore();
  });

  it('returns an empty images array when blob list returns no image files', async () => {
    // Override the default mock to return only non-image blobs.
    listMock.mockReset();
    listMock.mockResolvedValue({
      blobs: [
        { pathname: 'avatars/Season4/CrossTheLine/doc.pdf', url: 'https://cdn.example.com/doc.pdf', size: 100 },
      ],
      hasMore: false,
      cursor: undefined,
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get(`/api/campaigns/${firstCampaignId}/images`);
    expect(res.status).toBe(200);
    expect(res.body.images).toHaveLength(0);

    consoleSpy.mockRestore();
  });

  it('returns 404 for a campaign id that does not exist', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/campaigns/__no_such_campaign__/images');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');

    consoleSpy.mockRestore();
  });
});
