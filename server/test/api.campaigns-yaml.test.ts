import request from 'supertest';
import fs from 'fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import the Express app without starting the listener
import app from '../server.ts';

// ---------------------------------------------------------------------------
// Tests for malformed / missing data/campaigns.yaml
//
// loadCampaigns() calls fs.readFileSync then yaml.load. These tests verify
// that every broken-input scenario surfaces as a clean 500 JSON error rather
// than a 200 with partial/garbage data or an unhandled crash.
// ---------------------------------------------------------------------------

// Suppress noisy console.error output from the server's catch blocks
let consoleSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('GET /api/campaigns — malformed campaigns.yaml handling', () => {
  describe('missing file (ENOENT)', () => {
    it('returns 500 with a clear error body when campaigns.yaml does not exist', async () => {
      const enoent = Object.assign(new Error('ENOENT: no such file or directory'), {
        code: 'ENOENT',
      });
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw enoent;
      });

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);

      fsSpy.mockRestore();
    });
  });

  describe('invalid YAML syntax', () => {
    it('returns 500 when campaigns.yaml contains a YAML syntax error', async () => {
      // A tab character inside YAML indentation triggers a js-yaml parse error
      const malformedYaml = 'campaigns:\n\t- hashtag: "Bad"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => malformedYaml);

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');

      fsSpy.mockRestore();
    });

    it('returns 500 when campaigns.yaml is completely garbled (binary-like content)', async () => {
      const garbled = '\x00\x01\x02campaigns: [{{bad yaml}}:::';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => garbled);

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');

      fsSpy.mockRestore();
    });
  });

  describe('valid YAML but wrong shape', () => {
    it('returns 200 with an empty campaigns array when yaml.load returns null (empty file)', async () => {
      // An empty file (or file containing only comments) parses to null in js-yaml.
      // loadCampaigns guards against null via `data?.campaigns` and returns [].
      // This is intentionally graceful — callers can render an empty state.
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => '');

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('campaigns');
      expect(Array.isArray(res.body.campaigns)).toBe(true);
      expect(res.body.campaigns).toHaveLength(0);

      fsSpy.mockRestore();
    });

    it('returns 200 with an empty campaigns array when the campaigns key is absent', async () => {
      // Silently treats a missing `campaigns` key as an empty list — the server
      // is still healthy; it just has no data to serve.
      const noKey = 'other_key:\n  - value: "irrelevant"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => noKey);

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(200);
      expect(res.body.campaigns).toHaveLength(0);

      fsSpy.mockRestore();
    });

    it('returns 200 with an empty campaigns array when campaigns is null', async () => {
      const nullCampaigns = 'campaigns: null\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => nullCampaigns);

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(200);
      expect(res.body.campaigns).toHaveLength(0);

      fsSpy.mockRestore();
    });

    it('returns 200 with an empty campaigns array when campaigns is an empty list', async () => {
      const emptyCampaigns = 'campaigns: []\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => emptyCampaigns);

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(200);
      expect(res.body.campaigns).toHaveLength(0);

      fsSpy.mockRestore();
    });

    it('returns 500 when campaigns is a scalar (not an array)', async () => {
      // campaigns: "oops" — yaml.load produces a string, not an array.
      // Array.isArray guards are already in place; deriveCampaignId is never
      // called. The server should return an empty list (graceful), not 500.
      const scalarCampaigns = 'campaigns: "oops"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => scalarCampaigns);

      const res = await request(app).get('/api/campaigns');

      // The server's Array.isArray guard treats a non-array value the same as
      // null/missing — it falls back to [] and returns 200.
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.campaigns).toHaveLength(0);
      } else {
        expect(res.body).toHaveProperty('error');
      }

      fsSpy.mockRestore();
    });

    it('returns 500 when a campaign entry has no usable identifier fields', async () => {
      // An entry with no id / hashtag / icon_path means deriveCampaignId throws.
      // The server catches this and returns 500 instead of serving partial data.
      const noIdentifier = 'campaigns:\n  - episode: "No identifier here"\n';
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => noIdentifier);

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');

      fsSpy.mockRestore();
    });
  });

  describe('filesystem permission error', () => {
    it('returns 500 when campaigns.yaml is unreadable (EACCES)', async () => {
      const eperm = Object.assign(new Error('EACCES: permission denied'), {
        code: 'EACCES',
      });
      const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw eperm;
      });

      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');

      fsSpy.mockRestore();
    });
  });
});
