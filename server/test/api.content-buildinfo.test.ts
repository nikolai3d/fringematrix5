import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { jest, describe, it, expect, afterEach, beforeEach } from '@jest/globals';

import app, { resetBuildInfoCache } from '../server.ts';

// ---------------------------------------------------------------------------
// Edge-case coverage for:
//   GET /api/content/:page  — cache hit, TTL expiry, ENOENT -> 404, other
//                             read errors -> 500
//   GET /api/build-info     — malformed JSON, legacy `deployedAt`, read error
//   /api/* fallback for non-GET methods
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'content');
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'build-info.json');

const CONTENT_CACHE_TTL = 5 * 60 * 1000; // mirrors server.ts

afterEach(() => {
  jest.restoreAllMocks();
});

function readsOf(spy: { mock: { calls: unknown[][] } }, page: string): number {
  const target = path.join(CONTENT_DIR, `${page}.html`);
  return spy.mock.calls.filter((c) => c[0] === target).length;
}

describe('GET /api/content/:page — caching', () => {
  it('serves repeat requests from the in-memory cache within the TTL', async () => {
    const readSpy = jest.spyOn(fs.promises, 'readFile');
    const first = await request(app).get('/api/content/credits');
    const second = await request(app).get('/api/content/credits');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(readsOf(readSpy, 'credits')).toBe(1);
  });

  it('re-reads the file from disk once the TTL has elapsed', async () => {
    await request(app).get('/api/content/legal'); // ensure cached
    const readSpy = jest.spyOn(fs.promises, 'readFile');
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + CONTENT_CACHE_TTL + 1);
    const res = await request(app).get('/api/content/legal');
    expect(res.status).toBe(200);
    expect(readsOf(readSpy, 'legal')).toBe(1);
  });

  it('picks up changed file contents after the TTL (stale entry is refreshed)', async () => {
    await request(app).get('/api/content/history'); // ensure cached
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 2 * CONTENT_CACHE_TTL);
    jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('<p>fresh</p>' as never);
    const res = await request(app).get('/api/content/history');
    expect(res.body).toEqual({ content: '<p>fresh</p>', page: 'history' });

    // The refreshed entry is now what the cache serves.
    const again = await request(app).get('/api/content/history');
    expect(again.body.content).toBe('<p>fresh</p>');
  });
});

describe('GET /api/content/:page — errors', () => {
  // Push "now" far into the future so every cached page is expired and the
  // handler must hit fs.promises.readFile.
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 100 * CONTENT_CACHE_TTL);
  });

  it('returns 404 when the content file does not exist (ENOENT)', async () => {
    const enoent = Object.assign(new Error('no such file'), { code: 'ENOENT' });
    jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(enoent as never);
    const res = await request(app).get('/api/content/credits');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Content file not found' });
  });

  it('returns 500 for other read errors (e.g. EACCES) and logs them', async () => {
    const eacces = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(eacces as never);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/content/legal');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load content' });
    expect(errSpy).toHaveBeenCalledWith('Content read error:', eacces);
  });

  it('treats a non-Error rejection carrying code ENOENT as a 500 (instanceof guard)', async () => {
    jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce({ code: 'ENOENT' } as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/content/history');
    expect(res.status).toBe(500);
  });

  it('rejects page names outside the allow-list without touching the filesystem', async () => {
    const readSpy = jest.spyOn(fs.promises, 'readFile');
    for (const page of ['HISTORY', '..%2Fpackage', 'history.html', 'constructor', '__proto__']) {
      const res = await request(app).get(`/api/content/${page}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Content page not found' });
    }
    expect(readSpy).not.toHaveBeenCalled();
  });
});

describe('GET /api/build-info — edge cases', () => {
  beforeEach(() => {
    resetBuildInfoCache();
  });
  afterEach(() => {
    resetBuildInfoCache();
  });

  function stubBuildInfoFile(contents: string | (() => string)): void {
    const realExists = fs.existsSync;
    const realRead = fs.readFileSync;
    jest.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) =>
      path.resolve(String(p)) === BUILD_INFO_PATH ? true : realExists(p),
    );
    jest.spyOn(fs, 'readFileSync').mockImplementation(((p: any, ...rest: any[]) => {
      if (path.resolve(String(p)) === BUILD_INFO_PATH) {
        return typeof contents === 'function' ? contents() : contents;
      }
      return (realRead as any)(p, ...rest);
    }) as typeof fs.readFileSync);
  }

  it('returns all-null fields when build-info.json contains malformed JSON', async () => {
    stubBuildInfoFile('{ not json');
    const res = await request(app).get('/api/build-info');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ repoUrl: null, commitHash: null, builtAt: null });
  });

  it('falls back to the legacy deployedAt field when builtAt is absent', async () => {
    stubBuildInfoFile(JSON.stringify({ repoUrl: 'https://r', commitHash: 'abc', deployedAt: '2020-01-01T00:00:00Z' }));
    const res = await request(app).get('/api/build-info');
    expect(res.body).toEqual({ repoUrl: 'https://r', commitHash: 'abc', builtAt: '2020-01-01T00:00:00Z' });
  });

  it('prefers builtAt over deployedAt when both are present', async () => {
    stubBuildInfoFile(JSON.stringify({ builtAt: 'new', deployedAt: 'old' }));
    const res = await request(app).get('/api/build-info');
    expect(res.body.builtAt).toBe('new');
  });

  it('normalizes empty-string fields to null', async () => {
    stubBuildInfoFile(JSON.stringify({ repoUrl: '', commitHash: '', builtAt: '' }));
    const res = await request(app).get('/api/build-info');
    expect(res.body).toEqual({ repoUrl: null, commitHash: null, builtAt: null });
  });

  it('returns 500 JSON when build-info.json cannot be read', async () => {
    stubBuildInfoFile(() => {
      throw new Error('EIO');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/build-info');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load build info' });
  });

  it('caches the parsed result (file read once across requests)', async () => {
    stubBuildInfoFile(JSON.stringify({ commitHash: 'cached' }));
    const readSpy = fs.readFileSync as unknown as { mock: { calls: unknown[][] } };
    await request(app).get('/api/build-info');
    await request(app).get('/api/build-info');
    const reads = readSpy.mock.calls.filter((c) => path.resolve(String(c[0])) === BUILD_INFO_PATH).length;
    expect(reads).toBe(1);
  });
});

describe('unknown /api/* fallback', () => {
  it.each(['post', 'put', 'delete', 'patch'] as const)('returns JSON 404 for %s requests', async (method) => {
    const res = await (request(app) as any)[method]('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('returns JSON 404 for nested unknown API paths', async () => {
    const res = await request(app).get('/api/campaigns/x/images/extra');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
