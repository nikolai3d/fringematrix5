import request from 'supertest';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

// Tests for the self-host-only optimizations added in fringematrix5-833q:
//   1. compression middleware gzip-compresses sizeable API JSON responses
//      (a no-op on Vercel, where the edge CDN negotiates encoding).
//   2. setStaticCacheHeaders applies an immutable 1-year Cache-Control to
//      content-hashed files under assets/, while leaving index.html (and other
//      unhashed entry files) on a revalidate-every-time policy so deploys are
//      never stranded behind a long-lived cache.
import app, { setStaticCacheHeaders, CLIENT_DIST_DIR } from '../server.ts';

describe('compression middleware', () => {
  it('gzip-compresses a sizeable JSON API response when the client accepts it', async () => {
    // /api/authors returns the full author directory with per-author counts,
    // which is comfortably above the compression default 1 KB threshold.
    const res = await request(app)
      .get('/api/authors')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    // superagent transparently decodes the body, but the response headers
    // still record that the wire payload was gzip-encoded.
    expect(res.headers['content-encoding']).toBe('gzip');
    // compression sets Vary: Accept-Encoding so shared caches key on it.
    expect((res.headers['vary'] || '').toLowerCase()).toContain('accept-encoding');
  });

  it('does not compress when the client sends Accept-Encoding: identity', async () => {
    const res = await request(app)
      .get('/api/authors')
      .set('Accept-Encoding', 'identity');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});

// setStaticCacheHeaders takes a Response, but only ever calls setHeader on it,
// so a minimal stub is sufficient for a direct unit test (and avoids depending
// on a real client/dist build being present in the test environment).
function makeResStub() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
  };
}

describe('setStaticCacheHeaders', () => {
  it('marks content-hashed assets/ files as immutable for one year', () => {
    const res = makeResStub();
    const filePath = path.join(CLIENT_DIST_DIR, 'assets', 'main-B9ftD8Ow.js');
    setStaticCacheHeaders(res as any, filePath);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('keeps index.html on no-cache so deploys are picked up immediately', () => {
    const res = makeResStub();
    const filePath = path.join(CLIENT_DIST_DIR, 'index.html');
    setStaticCacheHeaders(res as any, filePath);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['cache-control']).not.toContain('immutable');
  });

  it('does not give a long-lived immutable cache to unhashed top-level files', () => {
    const res = makeResStub();
    const filePath = path.join(CLIENT_DIST_DIR, 'glyph-spinner-debug.html');
    setStaticCacheHeaders(res as any, filePath);
    expect(res.headers['cache-control']).toBe('no-cache');
  });
});
