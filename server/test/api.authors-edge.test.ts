import request from 'supertest';
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Edge-case coverage for the attribution-backed endpoints:
//   GET /api/authors
//   GET /api/authors/:handle   (real handles + the __unknown__ sentinel)
//   GET /api/campaigns/:id/images  (id / author join via buildImageAuthor)
//
// The attribution and image-registry modules are replaced with in-memory
// fakes so each test can shape the data precisely (soft-deleted images,
// missing registry rows, registry rows without campaignId, alternate
// handles, lookups that throw, ...). @vercel/blob is mocked too.
//
// NOTE: /api/authors/:handle image `src` is intentionally NOT asserted here —
// its shape is being changed independently (direct CDN URL vs /avatars/...).
// ---------------------------------------------------------------------------

interface FakeAuthor {
  handle: string;
  name: string;
  twitter_url: string | null;
  alternate_handles?: unknown;
  roles?: unknown;
}
interface FakeAttribution {
  handle: string | null;
  confidence: string;
  candidates?: unknown;
}
interface FakeImage {
  blobPath: string;
  campaignId: string | null;
  status: 'active' | 'deleted';
}

const state: {
  authors: FakeAuthor[];
  attribution: Record<string, FakeAttribution>;
  images: Record<string, FakeImage>;
  throwIn: string | null;
} = { authors: [], attribution: {}, images: {}, throwIn: null };

function maybeThrow(fn: string): void {
  if (state.throwIn === fn) throw new Error(`boom in ${fn}`);
}

function norm(h: string): string {
  const t = h.trim().toLowerCase();
  return t.startsWith('@') ? t : `@${t}`;
}

const getAuthors = jest.fn(() => {
  maybeThrow('getAuthors');
  return state.authors;
});
const getAuthorByHandle = jest.fn((handle: string) => {
  maybeThrow('getAuthorByHandle');
  if (typeof handle !== 'string' || !handle.trim()) return null;
  const n = norm(handle);
  for (const a of state.authors) {
    if (norm(a.handle) === n) return a;
    const alts = Array.isArray(a.alternate_handles) ? (a.alternate_handles as string[]) : [];
    if (alts.some((alt) => norm(alt) === n)) return a;
  }
  return null;
});
const getAllAttributions = jest.fn(() => {
  maybeThrow('getAllAttributions');
  return state.attribution;
});
const getAttributionForId = jest.fn((id: string) => {
  maybeThrow('getAttributionForId');
  return state.attribution[id] ?? null;
});
const getImageById = jest.fn((id: string) => {
  maybeThrow('getImageById');
  return state.images[id] ?? null;
});
const getImageByBlobPath = jest.fn((blobPath: string) => {
  maybeThrow('getImageByBlobPath');
  for (const [id, rec] of Object.entries(state.images)) {
    if (rec.blobPath === blobPath) return { id, record: rec };
  }
  return null;
});

jest.unstable_mockModule('../attribution.js', () => ({
  getAuthors,
  getAuthorByHandle,
  getAllAttributions,
  getAttributionForId,
  resetAttributionCache: jest.fn(),
}));

jest.unstable_mockModule('../images.js', () => ({
  getImageById,
  getImageByBlobPath,
  getAllImages: jest.fn(() => state.images),
  resetImagesCache: jest.fn(),
}));

const listMock = jest.fn<(opts?: unknown) => Promise<unknown>>();
jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;
let blobCache: Map<string, unknown>;

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token-authors-edge';
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const serverModule = await import('../server.ts');
  app = serverModule.default;
  blobCache = (serverModule as any).blobCache;
  logSpy.mockRestore();
});

beforeEach(() => {
  blobCache.clear();
  listMock.mockReset();
  state.throwIn = null;
  state.authors = [
    {
      handle: '@Alice',
      name: 'Alice A.',
      twitter_url: 'https://twitter.com/Alice',
      alternate_handles: ['@AliceOld'],
      roles: ['artist'],
    },
    { handle: '@Bob', name: 'Bob B.', twitter_url: null }, // no alternates/roles arrays
    { handle: '@Carol', name: 'Carol C.', twitter_url: null, alternate_handles: 'nope', roles: null },
  ];
  state.attribution = {
    'id-a1': { handle: '@Alice', confidence: 'high', candidates: [] },
    'id-a2': { handle: '@AliceOld', confidence: 'medium', candidates: [] }, // alternate handle
    'id-a3': { handle: '@alice', confidence: 'high', candidates: [] }, // soft-deleted
    'id-a4': { handle: '@Alice', confidence: 'high', candidates: [] }, // missing registry row
    'id-a5': { handle: '@Alice', confidence: 'high', candidates: [] }, // campaignId null -> derive
    'id-a6': { handle: '@Alice', confidence: 'high', candidates: [] }, // campaignId null, underivable
    'id-b1': { handle: '@Bob', confidence: 'high', candidates: [] },
    'id-ghost': { handle: '@NotInAuthorsYaml', confidence: 'medium', candidates: [] },
    'id-u1': { handle: null, confidence: 'unresolved', candidates: ['@Alice', '@Bob'] },
    'id-u2': { handle: '', confidence: 'unresolved', candidates: [] }, // empty string counts as unknown
    'id-u3': { handle: null, confidence: 'unresolved', candidates: [] }, // soft-deleted
    'id-u4': { handle: null, confidence: 'not-art', candidates: [] }, // campaignId null -> derive
    'id-u5': { handle: null, confidence: 'unresolved', candidates: [] }, // underivable path
  };
  state.images = {
    'id-a1': { blobPath: 'avatars/Season4/CrossTheLine/a1.png', campaignId: 'crosstheline', status: 'active' },
    'id-a2': { blobPath: 'avatars/Season4/BeABetterMan/a2.png', campaignId: 'beabetterman', status: 'active' },
    'id-a3': { blobPath: 'avatars/Season4/CrossTheLine/a3.png', campaignId: 'crosstheline', status: 'deleted' },
    'id-a5': { blobPath: 'avatars/Season5/Letters Of Transit/sub/a5.png', campaignId: null, status: 'active' },
    'id-a6': { blobPath: 'loose/a6.png', campaignId: null, status: 'active' },
    'id-b1': { blobPath: 'avatars/Season4/CrossTheLine/b1.png', campaignId: 'crosstheline', status: 'active' },
    'id-ghost': { blobPath: 'avatars/Season4/CrossTheLine/ghost.png', campaignId: 'crosstheline', status: 'active' },
    'id-u1': { blobPath: 'avatars/Season4/CrossTheLine/u1.png', campaignId: 'crosstheline', status: 'active' },
    'id-u2': { blobPath: 'avatars/Season4/CrossTheLine/u2.png', campaignId: 'crosstheline', status: 'active' },
    'id-u3': { blobPath: 'avatars/Season4/CrossTheLine/u3.png', campaignId: 'crosstheline', status: 'deleted' },
    'id-u4': { blobPath: 'avatars/Season3/Os!/u4.png', campaignId: null, status: 'active' },
    'id-u5': { blobPath: 'avatars/Season3//u5.png', campaignId: null, status: 'active' },
  };
});

async function quiet<T>(fn: () => PromiseLike<T>): Promise<T> {
  const e = jest.spyOn(console, 'error').mockImplementation(() => {});
  const l = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    return await fn();
  } finally {
    e.mockRestore();
    l.mockRestore();
  }
}

describe('GET /api/authors — edge cases', () => {
  it('counts alternate-handle and case-variant records under the canonical author', async () => {
    const res = await request(app).get('/api/authors');
    expect(res.status).toBe(200);
    const alice = res.body.authors.find((a: any) => a.handle === '@Alice');
    // id-a1, id-a2 (alternate), id-a3 (case variant; counts ignore registry
    // status), id-a4, id-a5, id-a6 => 6
    expect(alice.imageCount).toBe(6);
    const bob = res.body.authors.find((a: any) => a.handle === '@Bob');
    expect(bob.imageCount).toBe(1);
  });

  it('skips attribution handles that resolve to no author (not counted anywhere)', async () => {
    const res = await request(app).get('/api/authors');
    const total = res.body.authors.reduce((s: number, a: any) => s + a.imageCount, 0);
    // 13 records: 5 unknown (null/empty), 1 ghost handle, 7 attributed.
    expect(total).toBe(7);
    expect(res.body.unknownCount).toBe(5);
  });

  it('sorts by imageCount desc then handle asc, and normalizes non-array alternates/roles to []', async () => {
    const res = await request(app).get('/api/authors');
    expect(res.body.authors.map((a: any) => a.handle)).toEqual(['@Alice', '@Bob', '@Carol']);
    const carol = res.body.authors.find((a: any) => a.handle === '@Carol');
    expect(carol).toEqual({
      handle: '@Carol',
      name: 'Carol C.',
      twitterUrl: null,
      alternateHandles: [],
      roles: [],
      imageCount: 0,
    });
    const bob = res.body.authors.find((a: any) => a.handle === '@Bob');
    expect(bob.alternateHandles).toEqual([]);
    expect(bob.roles).toEqual([]);
  });

  it('returns 500 JSON when the authors directory fails to load', async () => {
    state.throwIn = 'getAuthors';
    const res = await quiet(() => request(app).get('/api/authors'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load authors' });
  });

  it('returns 500 JSON when the attribution table fails to load', async () => {
    state.throwIn = 'getAllAttributions';
    const res = await quiet(() => request(app).get('/api/authors'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load authors' });
  });
});

describe('GET /api/authors/:handle — edge cases', () => {
  it('unifies alternate-handle records, skips soft-deleted / unregistered / underivable images', async () => {
    const res = await request(app).get('/api/authors/@Alice');
    expect(res.status).toBe(200);
    expect(res.body.author).toEqual({
      handle: '@Alice',
      name: 'Alice A.',
      twitterUrl: 'https://twitter.com/Alice',
      alternateHandles: ['@AliceOld'],
      roles: ['artist'],
    });
    const byPath = res.body.images.map((i: any) => i.blobPath).sort();
    expect(byPath).toEqual([
      'avatars/Season4/BeABetterMan/a2.png', // alternate handle unified
      'avatars/Season4/CrossTheLine/a1.png',
      'avatars/Season5/Letters Of Transit/sub/a5.png', // derived campaignId
    ]);
    // Soft-deleted (a3), missing registry row (a4), underivable path (a6) excluded.
  });

  it('falls back to a slug of the campaign folder when the registry has no campaignId', async () => {
    const res = await request(app).get('/api/authors/@Alice');
    const a5 = res.body.images.find((i: any) => i.fileName === 'a5.png');
    expect(a5).toBeDefined();
    expect(a5.campaignId).toBe('letters-of-transit');
    expect(a5.confidence).toBe('high');
  });

  it('prefers the registry campaignId over the folder-derived slug', async () => {
    const res = await request(app).get('/api/authors/@Alice');
    const a2 = res.body.images.find((i: any) => i.fileName === 'a2.png');
    expect(a2.campaignId).toBe('beabetterman');
    expect(a2.confidence).toBe('medium');
  });

  it('resolves the same author when requested via an alternate handle', async () => {
    const res = await request(app).get('/api/authors/aliceold');
    expect(res.status).toBe(200);
    expect(res.body.author.handle).toBe('@Alice');
    expect(res.body.images).toHaveLength(3);
  });

  it('returns an empty image list for an author with no attributed images', async () => {
    const res = await request(app).get('/api/authors/@Carol');
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([]);
  });

  it('returns 500 JSON when the registry lookup throws', async () => {
    state.throwIn = 'getImageById';
    const res = await quiet(() => request(app).get('/api/authors/@Alice'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load author' });
  });

  it('returns 500 JSON when the author lookup throws', async () => {
    state.throwIn = 'getAuthorByHandle';
    const res = await quiet(() => request(app).get('/api/authors/@Alice'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load author' });
  });
});

describe('GET /api/authors/__unknown__ — edge cases', () => {
  it('lists active images with null/empty handles, deriving campaignId and skipping the rest', async () => {
    const res = await request(app).get('/api/authors/__UNKNOWN__');
    expect(res.status).toBe(200);
    expect(res.body.author).toEqual({
      handle: '__unknown__',
      name: 'Unknown artist',
      twitterUrl: null,
      alternateHandles: [],
      roles: [],
    });
    const images = res.body.images.map((i: any) => ({
      blobPath: i.blobPath,
      campaignId: i.campaignId,
      fileName: i.fileName,
      confidence: i.confidence,
    }));
    expect(images).toEqual(
      expect.arrayContaining([
        { blobPath: 'avatars/Season4/CrossTheLine/u1.png', campaignId: 'crosstheline', fileName: 'u1.png', confidence: 'unresolved' },
        { blobPath: 'avatars/Season4/CrossTheLine/u2.png', campaignId: 'crosstheline', fileName: 'u2.png', confidence: 'unresolved' },
        // "Os!" slugifies to "os"
        { blobPath: 'avatars/Season3/Os!/u4.png', campaignId: 'os', fileName: 'u4.png', confidence: 'not-art' },
      ]),
    );
    // u3 is soft-deleted; u5 has an empty campaign folder segment => no campaignId.
    expect(images).toHaveLength(3);
  });

  it('skips unknown records whose folder segment slugifies to empty', async () => {
    state.images['id-u1'] = { blobPath: 'avatars/Season4/@@@/u1.png', campaignId: null, status: 'active' };
    state.images['id-u2'] = { blobPath: 'notavatars/Season4/Folder/u2.png', campaignId: null, status: 'active' };
    state.images['id-u4'] = { blobPath: 'avatars/u4.png', campaignId: null, status: 'active' };
    const res = await request(app).get('/api/authors/__unknown__');
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([]);
  });

  it('returns 500 JSON when the attribution table fails to load', async () => {
    state.throwIn = 'getAllAttributions';
    const res = await quiet(() => request(app).get('/api/authors/__unknown__'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load author' });
  });
});

describe('GET /api/campaigns/:id/images — registry / attribution join', () => {
  const blobs = [
    { pathname: 'avatars/Season4/CrossTheLine/a1.png', url: 'https://cdn.example.com/a1.png', size: 10 },
    { pathname: 'avatars/Season4/CrossTheLine/b1.png', url: 'https://cdn.example.com/b1.png', size: 11 },
    { pathname: 'avatars/Season4/CrossTheLine/unregistered.webp', url: 'https://cdn.example.com/u.webp', size: 12 },
    { pathname: 'avatars/Season4/CrossTheLine/notes.md', url: 'https://cdn.example.com/notes.md', size: 13 },
    { pathname: 'avatars/Season4/CrossTheLine/UPPER.JPEG', url: 'https://cdn.example.com/UPPER.JPEG', size: 14 },
  ];

  let campaignId: string;
  beforeAll(async () => {
    const res = await request(app).get('/api/campaigns');
    campaignId = res.body.campaigns[0].id;
  });

  it('gives unregistered blobs id:null + author:null and filters non-images (case-insensitive ext)', async () => {
    listMock.mockResolvedValue({ blobs, hasMore: false });
    const res = await request(app).get(`/api/campaigns/${campaignId}/images`);
    expect(res.status).toBe(200);
    const names = res.body.images.map((i: any) => i.fileName);
    expect(names).toEqual(['a1.png', 'b1.png', 'unregistered.webp', 'UPPER.JPEG']);
    const unreg = res.body.images.find((i: any) => i.fileName === 'unregistered.webp');
    expect(unreg.id).toBeNull();
    expect(unreg.author).toBeNull();
    const a1 = res.body.images.find((i: any) => i.fileName === 'a1.png');
    expect(a1.id).toBe('id-a1');
    expect(a1.author).toEqual({
      handle: '@Alice',
      displayName: 'Alice A.',
      twitterUrl: 'https://twitter.com/Alice',
      confidence: 'high',
      candidates: [],
    });
  });

  it('returns author:null for a registered image that has no attribution record', async () => {
    delete state.attribution['id-b1'];
    listMock.mockResolvedValue({ blobs, hasMore: false });
    const res = await request(app).get(`/api/campaigns/${campaignId}/images`);
    const b1 = res.body.images.find((i: any) => i.fileName === 'b1.png');
    expect(b1.id).toBe('id-b1');
    expect(b1.author).toBeNull();
  });

  it('coerces non-array candidates to [] and leaves displayName null for an unknown handle', async () => {
    state.attribution['id-a1'] = { handle: '@NotInAuthorsYaml', confidence: 'medium', candidates: 'bad' };
    listMock.mockResolvedValue({ blobs, hasMore: false });
    const res = await request(app).get(`/api/campaigns/${campaignId}/images`);
    const a1 = res.body.images.find((i: any) => i.fileName === 'a1.png');
    expect(a1.author).toEqual({
      handle: '@NotInAuthorsYaml',
      displayName: null,
      twitterUrl: null,
      confidence: 'medium',
      candidates: [],
    });
  });

  it('degrades to author:null (still 200) when the attribution lookup throws', async () => {
    state.throwIn = 'getAttributionForId';
    listMock.mockResolvedValue({ blobs, hasMore: false });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get(`/api/campaigns/${campaignId}/images`);
    expect(res.status).toBe(200);
    const a1 = res.body.images.find((i: any) => i.fileName === 'a1.png');
    expect(a1.id).toBe('id-a1');
    expect(a1.author).toBeNull();
    expect(errSpy).toHaveBeenCalledWith('Attribution lookup failed for', 'id-a1', '-', 'boom in getAttributionForId');
    errSpy.mockRestore();
  });

  it('returns a generic 500 (not a blob 503) when the registry lookup throws', async () => {
    state.throwIn = 'getImageByBlobPath';
    listMock.mockResolvedValue({ blobs, hasMore: false });
    const res = await quiet(() => request(app).get(`/api/campaigns/${campaignId}/images`));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to list images from CDN' });
  });
});
