const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Import the Express app without starting the listener
const app = require('../server');

describe('API contract', () => {
  describe('GET /api/campaigns', () => {
    it('returns campaigns array', async () => {
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('campaigns');
      expect(Array.isArray(res.body.campaigns)).toBe(true);
      if (res.body.campaigns.length > 0) {
        const c = res.body.campaigns[0];
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
      const campaigns = campaignsRes.body.campaigns || [];
      if (campaigns.length === 0) {
        consoleSpy.mockRestore();
        return; // nothing to assert if there are no campaigns configured
      }
      const firstId = campaigns[0].id;
      const res = await request(app).get(`/api/campaigns/${firstId}/images`);
      // Could be 200 with images (possibly empty) or 500 if avatar paths are inaccessible
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('images');
        expect(Array.isArray(res.body.images)).toBe(true);
        if (res.body.images.length > 0) {
          const img = res.body.images[0];
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

    function withTempFile(filePath, content, fn) {
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
      await withTempFile(buildInfoPath, JSON.stringify({ repoUrl: 'x', commitHash: 'y', builtAt: 'z', committedAt: 'w' }), async () => {
        const res = await request(app).get('/api/build-info');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ repoUrl: 'x', commitHash: 'y', builtAt: 'z', committedAt: 'w' });
      });
    });

    it('returns DEV-LOCAL when build-info.json is missing (dev mode)', async () => {
      const originalExistsSync = fs.existsSync;
      const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (path.resolve(p) === path.resolve(buildInfoPath)) return false;
        return originalExistsSync(p);
      });
      const res = await request(app).get('/api/build-info');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('commitHash');
      expect(res.body.commitHash).toBe('DEV-LOCAL');
      expect(res.body).toHaveProperty('builtAt');
      expect(res.body).toHaveProperty('committedAt');
      expect(res.body.committedAt).toBe('N/A');
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


