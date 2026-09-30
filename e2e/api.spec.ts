import { test, expect } from '@playwright/test';
import { fetchCampaigns } from './helpers/campaigns';

/**
 * API sanity checks against the real server (the same one the UI specs use).
 * These run through Playwright's `request` fixture — no browser — so they are
 * fast and exercise the HTTP contract the client depends on: JSON everywhere
 * under /api (never the SPA's index.html), stable response shapes, and 404s
 * for unknown resources.
 */

test.describe('API sanity', () => {
  test('unknown /api/* path returns a JSON 404, not the SPA HTML', async ({ request }) => {
    const res = await request.get('/api/foo');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: 'Not found' });

    // Nested unknown paths are covered by the same catch-all.
    const nested = await request.get('/api/foo/bar/baz');
    expect(nested.status()).toBe(404);
    expect(nested.headers()['content-type']).toMatch(/application\/json/);
  });

  test('/api/campaigns returns a non-empty list with the expected shape', async ({ request }) => {
    const res = await request.get('/api/campaigns');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
    const body = await res.json();
    expect(Array.isArray(body.campaigns)).toBe(true);
    expect(body.campaigns.length).toBeGreaterThan(0);

    const ids = new Set<string>();
    for (const c of body.campaigns) {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
      expect(typeof c.hashtag).toBe('string');
      expect(c.hashtag.length).toBeGreaterThan(0);
      // The client prefixes '#' itself, so the stored hashtag must not.
      expect(c.hashtag.startsWith('#')).toBe(false);
      expect(typeof c.episode).toBe('string');
      expect(typeof c.icon_path).toBe('string');
      ids.add(c.id);
    }
    // Campaign ids double as URL hashes, so they must be unique.
    expect(ids.size).toBe(body.campaigns.length);
  });

  test('/api/campaigns/<unknown>/images returns a JSON 404', async ({ request }) => {
    const res = await request.get('/api/campaigns/definitely-not-a-campaign/images');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: 'Campaign not found' });
  });

  test('/api/campaigns/<id>/images returns an images array with the expected item shape', async ({ request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length === 0, 'No campaigns configured');

    const res = await request.get(`/api/campaigns/${encodeURIComponent(campaigns[0].id)}/images`);
    // 502/503 means the Blob backend is rate-limited/unavailable — an
    // environment condition, not a contract failure.
    test.skip([502, 503].includes(res.status()), `Blob backend unavailable (${res.status()})`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.images)).toBe(true);
    // Without BLOB_READ_WRITE_TOKEN the list is empty; only check item shape
    // when there is data.
    for (const img of body.images.slice(0, 20)) {
      expect(typeof img.src).toBe('string');
      expect(img.src).toMatch(/^https?:\/\//);
      expect(typeof img.fileName).toBe('string');
      expect(img.fileName.length).toBeGreaterThan(0);
      expect(typeof img.blobPath).toBe('string');
      expect('id' in img).toBe(true);
      expect('author' in img).toBe(true);
    }
  });

  test('/api/content/<page> serves the three content pages and 404s unknown ones', async ({ request }) => {
    for (const page of ['history', 'credits', 'legal']) {
      const res = await request.get(`/api/content/${page}`);
      expect(res.status(), `/api/content/${page}`).toBe(200);
      const body = await res.json();
      expect(body.page).toBe(page);
      expect(typeof body.content).toBe('string');
      expect(body.content.trim().length).toBeGreaterThan(0);
    }

    const bad = await request.get('/api/content/not-a-page');
    expect(bad.status()).toBe(404);
    expect(await bad.json()).toEqual({ error: 'Content page not found' });

    // Path-traversal-looking slugs are rejected by the allow-list, not read
    // from disk.
    const traversal = await request.get('/api/content/..%2F..%2Fpackage');
    expect(traversal.status()).toBe(404);
  });

  test('/api/build-info and /api/authors return JSON with the expected keys', async ({ request }) => {
    const info = await request.get('/api/build-info');
    expect(info.status()).toBe(200);
    const infoBody = await info.json();
    expect(infoBody).toHaveProperty('commitHash');
    expect(infoBody).toHaveProperty('builtAt');
    expect(infoBody).toHaveProperty('repoUrl');

    const authors = await request.get('/api/authors');
    expect(authors.status()).toBe(200);
    const authorsBody = await authors.json();
    expect(Array.isArray(authorsBody.authors)).toBe(true);
    for (const a of authorsBody.authors.slice(0, 20)) {
      expect(typeof a.handle).toBe('string');
      expect(typeof a.name).toBe('string');
    }

    const unknownAuthor = await request.get(`/api/authors/${encodeURIComponent('@no-such-artist-xyz')}`);
    expect(unknownAuthor.status()).toBe(404);
  });
});
