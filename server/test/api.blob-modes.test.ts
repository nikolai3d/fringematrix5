import request from 'supertest';
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// ---------------------------------------------------------------------------
// Blob empty-mode tests: BLOB_READ_WRITE_TOKEN absent.
//
// Verifies that GET /api/campaigns/:id/images returns 200 with an empty
// images array (not a 500) when no token is configured, and that the
// @vercel/blob list() function is never called in this code path.
// ---------------------------------------------------------------------------

const listMock = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('@vercel/blob', () => ({
  list: listMock,
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

let app: any;
const savedToken = process.env['BLOB_READ_WRITE_TOKEN'];

beforeAll(async () => {
  // Set to empty string rather than deleting: dotenv's `override: false` would
  // repopulate BLOB_READ_WRITE_TOKEN from .env.local if the key is absent, but
  // it respects an existing empty-string value, keeping HAS_BLOB_TOKEN false.
  process.env['BLOB_READ_WRITE_TOKEN'] = '';
  listMock.mockReset();

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const serverModule = await import('../server.ts');
  app = serverModule.default;
  consoleSpy.mockRestore();
});

afterAll(() => {
  // Restore the token to whatever it was before this suite so other test files
  // in the same Jest worker are not affected by the env mutation.
  if (savedToken !== undefined) {
    process.env['BLOB_READ_WRITE_TOKEN'] = savedToken;
  } else {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
  }
});

describe('GET /api/campaigns/:id/images — empty mode (no token)', () => {
  it('returns 200 for a known campaign', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const campaignsRes = await request(app).get('/api/campaigns');
    expect(campaignsRes.status).toBe(200);
    const campaigns: Array<{ id: string }> = campaignsRes.body.campaigns;
    expect(campaigns.length).toBeGreaterThan(0);

    const firstId = campaigns[0]!.id;
    const res = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res.status).toBe(200);

    consoleSpy.mockRestore();
  });

  it('returns an empty images array (not a 500)', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const campaignsRes = await request(app).get('/api/campaigns');
    const firstId: string = campaignsRes.body.campaigns[0].id;

    const res = await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('images');
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(res.body.images).toHaveLength(0);

    consoleSpy.mockRestore();
  });

  it('does not call the Vercel Blob list() function', async () => {
    listMock.mockReset();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const campaignsRes = await request(app).get('/api/campaigns');
    const firstId: string = campaignsRes.body.campaigns[0].id;

    await request(app).get(`/api/campaigns/${firstId}/images`);
    expect(listMock).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('returns 404 for an unknown campaign even in empty mode', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app).get('/api/campaigns/__no_such_campaign__/images');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');

    consoleSpy.mockRestore();
  });
});
