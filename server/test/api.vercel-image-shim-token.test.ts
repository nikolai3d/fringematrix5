import request from 'supertest';
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// The fake token must never reach the real Blob API.
jest.unstable_mockModule('@vercel/blob', () => ({
  list: jest.fn(async () => ({ blobs: [], hasMore: false })),
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

// /_vercel/image self-host shim when a Blob token IS configured: the store's
// public origin is known, so only that exact origin may be redirected to.
const FAKE_TOKEN = 'vercel_blob_rw_TeStStOrE42_fakesecretvalue';
const ORIGIN = 'https://teststore42.public.blob.vercel-storage.com';

let app: any;
const savedToken = process.env['BLOB_READ_WRITE_TOKEN'];

beforeAll(async () => {
  process.env['BLOB_READ_WRITE_TOKEN'] = FAKE_TOKEN;
  app = (await import('../server.ts')).default;
});

afterAll(() => {
  if (savedToken !== undefined) process.env['BLOB_READ_WRITE_TOKEN'] = savedToken;
  else delete process.env['BLOB_READ_WRITE_TOKEN'];
});

describe('GET /_vercel/image with a Blob token', () => {
  it('redirects to a URL on this deployment\'s own store', async () => {
    const target = `${ORIGIN}/avatars/Season4/x.jpg`;
    const res = await request(app).get('/_vercel/image').query({ url: target, w: '320' });
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe(target);
  });

  it('refuses another Blob store that would match remotePatterns', async () => {
    const res = await request(app)
      .get('/_vercel/image')
      .query({ url: 'https://otherstore.public.blob.vercel-storage.com/avatars/x.jpg' });
    expect(res.status).toBe(400);
    expect(res.headers['location']).toBeUndefined();
  });
});
