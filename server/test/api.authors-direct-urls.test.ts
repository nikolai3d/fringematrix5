import request from 'supertest';
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { UNKNOWN_ARTIST_HANDLE } from '../../shared/types.ts';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// /api/authors/:handle image URLs when a Blob token IS configured.
//
// The endpoint must hand out direct Blob CDN URLs (derived from the token's
// store id) instead of `/avatars/<path>` redirects, so author pages don't pay
// a serverless invocation + Blob list() call per thumbnail. list() must never
// be called: the URLs come from the registry, not from a Blob listing.
// ---------------------------------------------------------------------------

const listMock = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

const FAKE_TOKEN = 'vercel_blob_rw_TeStStOrE42_fakesecretvalue';
const ORIGIN = 'https://teststore42.public.blob.vercel-storage.com';

let app: any;
const savedToken = process.env['BLOB_READ_WRITE_TOKEN'];

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = FAKE_TOKEN;
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const serverModule = await import('../server.ts');
  app = serverModule.default;
  consoleSpy.mockRestore();
});

afterAll(() => {
  if (savedToken !== undefined) {
    process.env['BLOB_READ_WRITE_TOKEN'] = savedToken;
  } else {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
  }
});

function expectDirectUrl(img: { src: string; blobPath: string }) {
  expect(img.src.startsWith(`${ORIGIN}/avatars/`)).toBe(true);
  // Decoding the URL path must give back the exact registry blob path, so the
  // CDN request resolves to the same object the redirect route would.
  const decoded = decodeURIComponent(new URL(img.src).pathname.slice(1));
  expect(decoded).toBe(img.blobPath);
}

describe('GET /api/authors/:handle with a Blob token', () => {
  it('returns direct CDN URLs for a real author without listing Blob', async () => {
    listMock.mockClear();
    const res = await request(app).get('/api/authors/@Zort70');
    expect(res.status).toBe(200);
    expect(res.body.images.length).toBeGreaterThan(0);
    for (const img of res.body.images) expectDirectUrl(img);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('returns direct CDN URLs for the unknown-artist sentinel', async () => {
    listMock.mockClear();
    const res = await request(app).get(`/api/authors/${UNKNOWN_ARTIST_HANDLE}`);
    expect(res.status).toBe(200);
    for (const img of res.body.images) expectDirectUrl(img);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('encodes paths with spaces/parentheses exactly like Vercel Blob does', async () => {
    // Scan all authors for any image whose path needs encoding; the dataset
    // has several (e.g. "Be A Better Man icons"). Skip if none is attributed.
    const authorsRes = await request(app).get('/api/authors');
    const handles: string[] = authorsRes.body.authors.map((a: { handle: string }) => a.handle);
    let checked = 0;
    for (const handle of [...handles, UNKNOWN_ARTIST_HANDLE]) {
      const res = await request(app).get(`/api/authors/${encodeURIComponent(handle)}`);
      for (const img of res.body.images as Array<{ src: string; blobPath: string }>) {
        if (!/[ ()]/.test(img.blobPath)) continue;
        expectDirectUrl(img);
        expect(img.src).not.toMatch(/[ ()]/);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('includes the registry id on every image (real author and unknown artist)', async () => {
    // Share links from author mode carry the permanent id, so each image must
    // expose it, and it must be the registry entry for that blob path.
    const entries = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'images.json'), 'utf8'),
    ) as Record<string, { blobPath: string }>;
    for (const handle of ['@Zort70', UNKNOWN_ARTIST_HANDLE]) {
      const res = await request(app).get(`/api/authors/${handle}`);
      expect(res.status).toBe(200);
      expect(res.body.images.length).toBeGreaterThan(0);
      for (const img of res.body.images as Array<{ id: string; blobPath: string }>) {
        expect(typeof img.id).toBe('string');
        expect(entries[img.id]?.blobPath).toBe(img.blobPath);
      }
    }
  });
});
