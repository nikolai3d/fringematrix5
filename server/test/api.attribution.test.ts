import request from 'supertest';
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Attribution-enrichment tests for GET /api/campaigns/:id/images.
//
// Asserts that each image returned by the campaign-images endpoint carries an
// `author` block matching the ImageAuthor wire type from shared/types.ts:
//
//   { handle, displayName, twitterUrl, confidence, candidates }
//
// The Vercel Blob `list()` call is mocked to return synthetic blob entries
// whose `pathname` values match real keys in data/attribution.json, so the
// in-memory join performed by the route handler produces predictable output
// without touching the network.
//
// Internal-only attribution fields (`method`, `evidence`) must NOT leak into
// the wire response — that contract is verified explicitly.
// ---------------------------------------------------------------------------

const listMock = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;
let blobCache: Map<string, unknown>;
const savedToken = process.env['BLOB_READ_WRITE_TOKEN'];

// Real attribution keys taken from data/attribution.json.
// - The BABM-zort70 entries are high-confidence (handle: "@Zort70")
// - The AcrossTheUniverse root file is unresolved (handle: null,
//   non-empty candidates).
// A synthetic "no-attribution" path lets us exercise the defensive
// `author: null` branch.
const BABM_BLOBS = [
  {
    pathname: 'avatars/Season4/BeABetterMan/BABM-zort70/beabettermanBlack.jpg',
    url: 'https://cdn.example.com/avatars/Season4/BeABetterMan/BABM-zort70/beabettermanBlack.jpg',
    size: 1024,
  },
  {
    pathname: 'avatars/Season4/BeABetterMan/BABM-zort70/beabettermanBlue.jpg',
    url: 'https://cdn.example.com/avatars/Season4/BeABetterMan/BABM-zort70/beabettermanBlue.jpg',
    size: 1024,
  },
  // Path NOT in data/attribution.json — must yield author: null.
  {
    pathname: 'avatars/Season4/BeABetterMan/__synthetic__/no-attribution.png',
    url: 'https://cdn.example.com/avatars/Season4/BeABetterMan/__synthetic__/no-attribution.png',
    size: 512,
  },
];

const ATU_UNRESOLVED_BLOBS = [
  {
    pathname: 'avatars/Season4/AcrossTheUniverse/acrosstheuniverse.gif',
    url: 'https://cdn.example.com/avatars/Season4/AcrossTheUniverse/acrosstheuniverse.gif',
    size: 256,
  },
];

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token-attribution';

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const serverModule = await import('../server.ts');
  app = serverModule.default;
  blobCache = (serverModule as any).blobCache;
  consoleSpy.mockRestore();
});

afterAll(() => {
  if (savedToken !== undefined) {
    process.env['BLOB_READ_WRITE_TOKEN'] = savedToken;
  } else {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
  }
  listMock.mockReset();
});

beforeEach(() => {
  blobCache.clear();
  listMock.mockReset();
});

interface ImageWithAuthor {
  src: string;
  fileName: string;
  blobPath: string;
  size: number;
  author: {
    handle: string | null;
    displayName: string | null;
    twitterUrl: string | null;
    confidence: 'high' | 'medium' | 'unresolved';
    candidates: string[];
  } | null;
}

describe('GET /api/campaigns/:id/images — author enrichment', () => {
  it('attaches an `author` field (object or null) to every image', async () => {
    listMock.mockResolvedValue({ blobs: BABM_BLOBS, hasMore: false, cursor: undefined });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/campaigns/beabetterman/images');
    expect(res.status).toBe(200);
    const images: ImageWithAuthor[] = res.body.images;
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img).toHaveProperty('author');
      // author is either an object or explicitly null — never undefined.
      expect(img.author === null || typeof img.author === 'object').toBe(true);
    }

    consoleSpy.mockRestore();
  });

  it('resolves a high-confidence BABM-zort70 image to @Zort70 with a displayName', async () => {
    listMock.mockResolvedValue({ blobs: BABM_BLOBS, hasMore: false, cursor: undefined });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/campaigns/beabetterman/images');
    expect(res.status).toBe(200);
    const images: ImageWithAuthor[] = res.body.images;
    const zortImage = images.find(
      img => img.blobPath === 'avatars/Season4/BeABetterMan/BABM-zort70/beabettermanBlack.jpg',
    );
    expect(zortImage).toBeDefined();
    expect(zortImage!.author).not.toBeNull();
    expect(zortImage!.author!.handle).toBe('@Zort70');
    expect(zortImage!.author!.confidence).toBe('high');
    expect(typeof zortImage!.author!.displayName).toBe('string');
    expect(zortImage!.author!.displayName!.length).toBeGreaterThan(0);
    expect(zortImage!.author!.twitterUrl).toBe('https://twitter.com/Zort70');
    expect(Array.isArray(zortImage!.author!.candidates)).toBe(true);

    consoleSpy.mockRestore();
  });

  it('returns author: null for an image whose blob path has no attribution entry', async () => {
    listMock.mockResolvedValue({ blobs: BABM_BLOBS, hasMore: false, cursor: undefined });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/campaigns/beabetterman/images');
    expect(res.status).toBe(200);
    const images: ImageWithAuthor[] = res.body.images;
    const orphan = images.find(
      img => img.blobPath === 'avatars/Season4/BeABetterMan/__synthetic__/no-attribution.png',
    );
    expect(orphan).toBeDefined();
    expect(orphan!.author).toBeNull();

    consoleSpy.mockRestore();
  });

  it('does not leak internal-only `method` / `evidence` fields in the author block', async () => {
    listMock.mockResolvedValue({ blobs: BABM_BLOBS, hasMore: false, cursor: undefined });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/campaigns/beabetterman/images');
    expect(res.status).toBe(200);
    const images: ImageWithAuthor[] = res.body.images;
    for (const img of images) {
      if (img.author !== null) {
        expect(img.author).not.toHaveProperty('method');
        expect(img.author).not.toHaveProperty('evidence');
      }
    }

    consoleSpy.mockRestore();
  });

  it('exposes an unresolved image as handle: null with non-empty candidates[]', async () => {
    listMock.mockResolvedValue({ blobs: ATU_UNRESOLVED_BLOBS, hasMore: false, cursor: undefined });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/campaigns/acrosstheuniverse/images');
    expect(res.status).toBe(200);
    const images: ImageWithAuthor[] = res.body.images;
    expect(images.length).toBeGreaterThan(0);
    const unresolved = images[0]!;
    expect(unresolved.author).not.toBeNull();
    expect(unresolved.author!.handle).toBeNull();
    expect(unresolved.author!.confidence).toBe('unresolved');
    expect(unresolved.author!.displayName).toBeNull();
    expect(unresolved.author!.twitterUrl).toBeNull();
    expect(unresolved.author!.candidates.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });
});
