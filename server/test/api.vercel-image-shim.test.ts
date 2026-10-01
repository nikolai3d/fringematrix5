import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Self-host shim for /_vercel/image (fringematrix5-nzp2.7). Without it the SPA
// fallback returned index.html for every thumbnail srcset candidate.
//
// These run WITHOUT a Blob token (an empty value also stops .env.local from
// supplying one), so any Blob store matching remotePatterns is accepted. The
// token case lives in api.vercel-image-shim-token.test.ts.
let app: any;
const savedToken = process.env['BLOB_READ_WRITE_TOKEN'];

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = '';
  app = (await import('../server.ts')).default;
});

afterAll(() => {
  if (savedToken !== undefined) process.env['BLOB_READ_WRITE_TOKEN'] = savedToken;
  else delete process.env['BLOB_READ_WRITE_TOKEN'];
});

describe('GET /_vercel/image (self-host shim)', () => {
  const blobUrl = 'https://store1.public.blob.vercel-storage.com/avatars/Season4/A%20B/x.jpg';

  it('redirects to the original Blob URL, ignoring w/q', async () => {
    const res = await request(app)
      .get('/_vercel/image')
      .query({ url: blobUrl, w: '320', q: '75' });
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe(blobUrl);
    expect(res.headers['cache-control']).toContain('max-age=86400');
  });

  it('never serves the SPA HTML for this path', async () => {
    const res = await request(app).get('/_vercel/image');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('refuses to redirect to other hosts (no open redirect)', async () => {
    const res = await request(app).get('/_vercel/image').query({ url: 'https://evil.example.com/avatars/x.jpg' });
    expect(res.status).toBe(400);
    expect(res.headers['location']).toBeUndefined();
  });

  it('refuses Blob URLs outside /avatars/', async () => {
    const res = await request(app)
      .get('/_vercel/image')
      .query({ url: 'https://store1.public.blob.vercel-storage.com/secret.json' });
    expect(res.status).toBe(400);
  });
});
