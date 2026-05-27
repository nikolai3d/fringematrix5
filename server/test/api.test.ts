import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the Express app without starting the listener
import app, { resetCampaignsCache, resetBuildInfoCache } from '../server.ts';

interface Campaign {
  id: string;
  [key: string]: any;
}

interface ImageData {
  src: string;
  fileName: string;
  [key: string]: any;
}


describe('API contract', () => {
  describe('GET /api/campaigns', () => {
    it('returns campaigns array', async () => {
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('campaigns');
      expect(Array.isArray(res.body.campaigns)).toBe(true);
      if (res.body.campaigns.length > 0) {
        const c: Campaign = res.body.campaigns[0];
        expect(typeof c.id).toBe('string');
      }
    });

    it('includes Cache-Control header for CDN/browser caching', async () => {
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');
      expect(res.headers['vary']).toContain('Accept-Encoding');
    });

    it('handles data read failures with 500', async () => {
      resetCampaignsCache();
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw new Error('test read error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      fsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('returns 500 when a campaign has no usable identifier', async () => {
      resetCampaignsCache();
      const malformed = 'campaigns:\n  - episode: "Lonely entry with no id"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => malformed);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      fsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('returns 500 when all identifier fields slugify to empty strings', async () => {
      // id/hashtag/icon_path are truthy strings but contain no alphanumerics,
      // so slugify() collapses them all to ''. Must fail loudly rather than
      // produce a campaign with id: '' that would shadow other entries.
      resetCampaignsCache();
      const noSlugifiable =
        'campaigns:\n' +
        '  - id: "@@@"\n' +
        '    hashtag: "!!!"\n' +
        '    icon_path: "***"\n' +
        '    episode: "Edge case"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => noSlugifiable);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(500);
      fsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('falls through to hashtag when id is present but slugifies to empty', async () => {
      // id is a non-empty string but produces an empty slug — should fall
      // through to hashtag rather than throwing.
      resetCampaignsCache();
      const fallthrough =
        'campaigns:\n' +
        '  - id: "@@@"\n' +
        '    hashtag: "RealHashtag"\n' +
        '    episode: "Test"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => fallthrough);
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(200);
      expect(res.body.campaigns[0].id).toBe('realhashtag');
      fsSpy.mockRestore();
    });

    it('uses explicit id from yaml when provided', async () => {
      resetCampaignsCache();
      const yamlWithIds =
        'campaigns:\n' +
        '  - id: "my-explicit-id"\n' +
        '    hashtag: "DifferentHashtag"\n' +
        '    episode: "Test"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => yamlWithIds);
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(200);
      expect(res.body.campaigns[0].id).toBe('my-explicit-id');
      fsSpy.mockRestore();
    });
  });

  describe('GET /api/campaigns/:id/images', () => {
    it('returns images for a known campaign when present', async () => {
      resetCampaignsCache();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const campaignsRes = await request(app).get('/api/campaigns');
      expect(campaignsRes.status).toBe(200);
      const campaigns: Campaign[] = campaignsRes.body.campaigns || [];
      if (campaigns.length === 0) {
        consoleSpy.mockRestore();
        return; // nothing to assert if there are no campaigns configured
      }
      const firstId = campaigns[0]!.id;
      const res = await request(app).get(`/api/campaigns/${firstId}/images`);
      // Could be 200 with images (possibly empty), or 503 if the upstream blob
      // service is unavailable. 500 stays in the set for legacy / unexpected
      // server errors that aren't blob-related.
      expect([200, 500, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('images');
        expect(Array.isArray(res.body.images)).toBe(true);
        if (res.body.images.length > 0) {
          const img: ImageData = res.body.images[0];
          expect(typeof img.src).toBe('string');
          expect(typeof img.fileName).toBe('string');
        }
      }
      consoleSpy.mockRestore();
    });

    it('404s for unknown campaign', async () => {
      const res = await request(app).get('/api/campaigns/__does_not_exist__/images');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('GET /api/build-info', () => {
    const projectRoot = path.join(__dirname, '..', '..');
    const buildInfoPath = path.join(projectRoot, 'build-info.json');

    // Reset the module-level cache before each test so that file or mock
    // changes made within a test are picked up by getBuildInfo().
    beforeEach(() => {
      resetBuildInfoCache();
    });

    it('includes Cache-Control header for CDN/browser caching', async () => {
      const res = await request(app).get('/api/build-info');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');
      expect(res.headers['vary']).toContain('Accept-Encoding');
    });

    function withTempFile<T>(filePath: string, content: string, fn: () => Promise<T>): Promise<T> {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const existed = fs.existsSync(filePath);
      const backup = `${filePath}.bak.test`;
      if (existed) fs.copyFileSync(filePath, backup);
      fs.writeFileSync(filePath, content);
      // Reset the cache after writing the temp file so getBuildInfo() reads it.
      resetBuildInfoCache();
      return fn()
        .finally(() => {
          if (existed) {
            fs.copyFileSync(backup, filePath);
            fs.unlinkSync(backup);
          } else {
            fs.unlinkSync(filePath);
          }
        });
    }

    it('returns fields from build-info.json when present', async () => {
      await withTempFile(buildInfoPath, JSON.stringify({ repoUrl: 'x', commitHash: 'y', builtAt: 'z' }), async () => {
        const res = await request(app).get('/api/build-info');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ repoUrl: 'x', commitHash: 'y', builtAt: 'z' });
      });
    });

    it('returns DEV-LOCAL when build-info.json is missing (dev mode)', async () => {
      const originalExistsSync = fs.existsSync;
      const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
        if (path.resolve(p.toString()) === path.resolve(buildInfoPath)) return false;
        return originalExistsSync(p);
      });
      const res = await request(app).get('/api/build-info');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('commitHash');
      expect(res.body.commitHash).toBe('DEV-LOCAL');
      expect(res.body).toHaveProperty('builtAt');
      existsSpy.mockRestore();
    });
  });

  describe('GET /api/glyphs', () => {
    it('returns 200 with glyphs array structure', async () => {
      // Endpoint returns 200 with glyphs: string[] structure
      // - Empty array when BLOB_READ_WRITE_TOKEN is missing (graceful fallback)
      // - Populated array when token exists and blob API succeeds
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const res = await request(app).get('/api/glyphs');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('glyphs');
      expect(Array.isArray(res.body.glyphs)).toBe(true);
      
      // Each glyph (if any) should be a non-empty string URL
      res.body.glyphs.forEach((glyph: unknown) => {
        expect(typeof glyph).toBe('string');
        expect((glyph as string).length).toBeGreaterThan(0);
      });
      consoleSpy.mockRestore();
    });
  });

  describe('fallback /api/*', () => {
    it('returns 404 JSON for unknown endpoints', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('GET /api/content/:page', () => {
    it('returns history content', async () => {
      const res = await request(app).get('/api/content/history');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('page', 'history');
      expect(typeof res.body.content).toBe('string');
      expect(res.body.content.length).toBeGreaterThan(0);
    });

    it('returns credits content', async () => {
      const res = await request(app).get('/api/content/credits');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('page', 'credits');
      expect(typeof res.body.content).toBe('string');
      expect(res.body.content.length).toBeGreaterThan(0);
    });

    it('returns legal content', async () => {
      const res = await request(app).get('/api/content/legal');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('page', 'legal');
      expect(typeof res.body.content).toBe('string');
      expect(res.body.content.length).toBeGreaterThan(0);
    });

    it('returns 404 for invalid content page', async () => {
      const res = await request(app).get('/api/content/invalid-page');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(expect.objectContaining({ error: 'Content page not found' }));
    });

    it('returns 404 for missing page parameter', async () => {
      // Without trailing slash - matches catch-all /api/* route
      const res1 = await request(app).get('/api/content');
      expect(res1.status).toBe(404);
      expect(res1.body).toEqual(expect.objectContaining({ error: 'Not found' }));

      // With trailing slash - also matches catch-all /api/* route
      // (Express treats empty string after slash as no parameter)
      const res2 = await request(app).get('/api/content/');
      expect(res2.status).toBe(404);
      expect(res2.body).toEqual(expect.objectContaining({ error: 'Not found' }));
    });

    it('content contains HTML markup', async () => {
      const res = await request(app).get('/api/content/history');
      expect(res.status).toBe(200);
      // Check that content contains some HTML tags
      expect(res.body.content).toMatch(/<h[23]>/);
      expect(res.body.content).toMatch(/<\/p>/);
    });
  });

  describe('GET /api/authors', () => {
    it('returns authors sorted by imageCount desc with non-snake-case shape', async () => {
      const res = await request(app).get('/api/authors');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('authors');
      expect(Array.isArray(res.body.authors)).toBe(true);
      expect(res.body.authors.length).toBeGreaterThan(0);

      // Wire shape is camelCase — no snake_case fields should leak through.
      const first = res.body.authors[0];
      expect(first).toHaveProperty('handle');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('twitterUrl');
      expect(first).toHaveProperty('alternateHandles');
      expect(first).toHaveProperty('roles');
      expect(first).toHaveProperty('imageCount');
      expect(first).not.toHaveProperty('twitter_url');
      expect(first).not.toHaveProperty('alternate_handles');

      // Sorted by imageCount desc.
      const counts: number[] = res.body.authors.map((a: { imageCount: number }) => a.imageCount);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]!);
      }

      // @Zort70 should be present with the expected count from data/attribution.json.
      const zort = res.body.authors.find((a: { handle: string }) => a.handle === '@Zort70');
      expect(zort).toBeDefined();
      expect(zort.imageCount).toBe(98);
    });

    it('includes Cache-Control header for CDN/browser caching', async () => {
      const res = await request(app).get('/api/authors');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');
      expect(res.headers['vary']).toContain('Accept-Encoding');
    });
  });

  describe('GET /api/authors/:handle', () => {
    it('returns author detail with non-empty images list', async () => {
      const res = await request(app).get('/api/authors/@Zort70');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('author');
      expect(res.body.author.handle).toBe('@Zort70');
      expect(res.body.author).toHaveProperty('twitterUrl');
      expect(Array.isArray(res.body.images)).toBe(true);
      expect(res.body.images.length).toBeGreaterThan(0);

      const img = res.body.images[0];
      expect(typeof img.src).toBe('string');
      expect(img.src.startsWith('/avatars/')).toBe(true);
      expect(typeof img.fileName).toBe('string');
      expect(img.fileName.length).toBeGreaterThan(0);
      expect(typeof img.blobPath).toBe('string');
      expect(img.blobPath.startsWith('avatars/')).toBe(true);
      expect(typeof img.campaignId).toBe('string');
      expect(img.campaignId.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'unresolved']).toContain(img.confidence);
    });

    it('matches handles case-insensitively (with @ prefix)', async () => {
      const res = await request(app).get('/api/authors/@zort70');
      expect(res.status).toBe(200);
      expect(res.body.author.handle).toBe('@Zort70');
      expect(res.body.images.length).toBeGreaterThan(0);
    });

    it('matches handles without an @ prefix', async () => {
      const res = await request(app).get('/api/authors/zort70');
      expect(res.status).toBe(200);
      expect(res.body.author.handle).toBe('@Zort70');
    });

    it('campaignId for each image matches an existing campaign', async () => {
      const campaignsRes = await request(app).get('/api/campaigns');
      expect(campaignsRes.status).toBe(200);
      const ids = new Set<string>((campaignsRes.body.campaigns as Array<{ id: string }>).map((c) => c.id));

      const res = await request(app).get('/api/authors/@Zort70');
      expect(res.status).toBe(200);
      for (const img of res.body.images as Array<{ campaignId: string }>) {
        expect(ids.has(img.campaignId)).toBe(true);
      }
    });

    it('404s for an unknown handle', async () => {
      const res = await request(app).get('/api/authors/@Doesnotexist');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(expect.objectContaining({ error: 'Author not found' }));
    });

    it('includes Cache-Control header for CDN/browser caching', async () => {
      const res = await request(app).get('/api/authors/@Zort70');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');
      expect(res.headers['vary']).toContain('Accept-Encoding');
    });
  });

  describe('GET /api/authors (unknownCount)', () => {
    it('includes a positive unknownCount field', async () => {
      const res = await request(app).get('/api/authors');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('unknownCount');
      // The current data file has 966 unattributed entries. We assert > 0
      // rather than a hard-coded number so the test stays robust to small
      // attribution data updates.
      expect(typeof res.body.unknownCount).toBe('number');
      expect(res.body.unknownCount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/authors/__unknown__ (sentinel)', () => {
    it('returns the synthetic Unknown artist with a non-empty images list', async () => {
      const res = await request(app).get('/api/authors/__unknown__');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('author');
      expect(res.body.author.handle).toBe('__unknown__');
      expect(res.body.author.name).toBe('Unknown artist');
      expect(res.body.author.twitterUrl).toBeNull();
      expect(res.body.author.alternateHandles).toEqual([]);
      expect(res.body.author.roles).toEqual([]);

      expect(Array.isArray(res.body.images)).toBe(true);
      expect(res.body.images.length).toBeGreaterThan(0);

      // Each image carries the standard shape: src, fileName, blobPath,
      // campaignId, confidence. Confidence for unattributed records is
      // 'unresolved' in the current dataset, but we don't hard-assert that
      // here — just check the field type to allow future widening.
      const img = res.body.images[0];
      expect(typeof img.src).toBe('string');
      expect(img.src.startsWith('/avatars/')).toBe(true);
      expect(typeof img.fileName).toBe('string');
      expect(img.fileName.length).toBeGreaterThan(0);
      expect(typeof img.blobPath).toBe('string');
      expect(img.blobPath.startsWith('avatars/')).toBe(true);
      expect(typeof img.campaignId).toBe('string');
      expect(img.campaignId.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'unresolved']).toContain(img.confidence);
    });

    it('image count matches the unknownCount on /api/authors', async () => {
      const listRes = await request(app).get('/api/authors');
      const detailRes = await request(app).get('/api/authors/__unknown__');
      expect(listRes.status).toBe(200);
      expect(detailRes.status).toBe(200);
      // unknownCount counts every record with handle === null. The detail
      // endpoint skips records whose blobPath doesn't yield a campaignId,
      // so the detail list can in principle be smaller. In the current
      // dataset every unattributed record has a valid campaign-shaped path,
      // so the two should match exactly. The assertion is `<=` so a future
      // off-shape entry doesn't break the contract gratuitously.
      expect(detailRes.body.images.length).toBeLessThanOrEqual(listRes.body.unknownCount);
      expect(detailRes.body.images.length).toBeGreaterThan(0);
    });

    it('is case-insensitive on the sentinel', async () => {
      const lower = await request(app).get('/api/authors/__unknown__');
      const upper = await request(app).get('/api/authors/__UNKNOWN__');
      expect(lower.status).toBe(200);
      expect(upper.status).toBe(200);
      expect(upper.body.author.handle).toBe('__unknown__');
      expect(upper.body.images.length).toBe(lower.body.images.length);
    });

    it('includes Cache-Control header for CDN/browser caching', async () => {
      const res = await request(app).get('/api/authors/__unknown__');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');
      expect(res.headers['vary']).toContain('Accept-Encoding');
    });
  });

  describe('Security headers', () => {
    it('does not emit X-Powered-By header', async () => {
      const res = await request(app).get('/api/campaigns');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
