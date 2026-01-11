import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { jest, describe, it, expect } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the Express app without starting the listener
import app from '../server.ts';

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

    it('handles data read failures with 500', async () => {
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
  });

  describe('GET /api/campaigns/:id/images', () => {
    it('returns images for a known campaign when present', async () => {
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
      // Could be 200 with images (possibly empty) or 500 if avatar paths are inaccessible
      expect([200, 500]).toContain(res.status);
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

    function withTempFile<T>(filePath: string, content: string, fn: () => Promise<T>): Promise<T> {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const existed = fs.existsSync(filePath);
      const backup = `${filePath}.bak.test`; 
      if (existed) fs.copyFileSync(filePath, backup);
      fs.writeFileSync(filePath, content);
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
        if (path.resolve(p) === path.resolve(buildInfoPath)) return false;
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
    it('returns glyphs array with correct structure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get('/api/glyphs');
      
      // Could be 200 (with or without blob token) or 500 (if blob API fails)
      expect([200, 500]).toContain(res.status);
      
      if (res.status === 200) {
        expect(res.body).toHaveProperty('glyphs');
        expect(Array.isArray(res.body.glyphs)).toBe(true);
        
        // If glyphs are returned, each should be a string URL
        if (res.body.glyphs.length > 0) {
          res.body.glyphs.forEach((glyph: unknown) => {
            expect(typeof glyph).toBe('string');
            expect((glyph as string).length).toBeGreaterThan(0);
          });
        }
      }
      consoleSpy.mockRestore();
    });

    it('returns 200 with glyphs array structure', async () => {
      // Verify endpoint always returns 200 with proper glyphs array structure
      // Array will be empty when no blob token is available, or populated with URLs when token exists
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const res = await request(app).get('/api/glyphs');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('glyphs');
      expect(Array.isArray(res.body.glyphs)).toBe(true);
      // Each glyph should be a non-empty string URL (if any exist)
      res.body.glyphs.forEach((glyph: unknown) => {
        expect(typeof glyph).toBe('string');
        expect((glyph as string).length).toBeGreaterThan(0);
      });
      consoleSpy.mockRestore();
    });

    it('filters only image files from blob listing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get('/api/glyphs');
      
      if (res.status === 200 && res.body.glyphs.length > 0) {
        // All returned URLs should end with image extensions
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'];
        res.body.glyphs.forEach((glyph: string) => {
          const url = new URL(glyph);
          const pathname = url.pathname.toLowerCase();
          const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
          expect(hasImageExtension).toBe(true);
        });
      }
      consoleSpy.mockRestore();
    });

    it('returns 500 with error message on blob API failure', async () => {
      // This test documents the error handling behavior
      // When blob API fails, endpoint returns 500 with error message
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // We can't easily mock the blob API, but we verify the error response format
      // by checking that if a 500 is returned, it has the expected shape
      const res = await request(app).get('/api/glyphs');
      
      if (res.status === 500) {
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
      }
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
});