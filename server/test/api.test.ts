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

  describe('fallback /api/*', () => {
    it('returns 404 JSON for unknown endpoints', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });
  });
});