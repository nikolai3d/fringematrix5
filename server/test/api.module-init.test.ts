import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { jest, describe, it, expect, afterEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Module-initialization branches of server.ts that depend on the environment
// at import time (NODE_ENV, presence of build-info.json and client/dist):
//   - ensureDevBuildInfo(): creates a DEV-LOCAL build-info.json, or warns
//     when it cannot be written
//   - loadBuildInfo(): the "production + client build + no file" all-null path
//   - express.static / SPA fallback: client/dist vs public/ index.html
//
// Each test re-imports server.ts in a fresh module registry after stubbing
// fs so HAS_CLIENT_BUILD / IS_DEV / the build-info existence check resolve as
// needed. fs.writeFileSync is always stubbed so the real build-info.json is
// never touched. res.sendFile is stubbed to echo the resolved path so the SPA
// fallback is asserted deterministically whether or not client/dist exists.
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'build-info.json');
const CLIENT_INDEX = path.join(PROJECT_ROOT, 'client', 'dist', 'index.html');
const PUBLIC_INDEX = path.join(PROJECT_ROOT, 'public', 'index.html');

const savedNodeEnv = process.env['NODE_ENV'];

afterEach(() => {
  jest.restoreAllMocks();
  if (savedNodeEnv === undefined) delete process.env['NODE_ENV'];
  else process.env['NODE_ENV'] = savedNodeEnv;
});

interface LoadOpts {
  nodeEnv: string;
  buildInfoExists: boolean;
  clientBuild: boolean;
  writeThrows?: boolean;
}

async function loadServer(opts: LoadOpts) {
  process.env['NODE_ENV'] = opts.nodeEnv;
  const realExists = fs.existsSync;
  jest.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
    const resolved = path.resolve(String(p));
    if (resolved === BUILD_INFO_PATH) return opts.buildInfoExists;
    if (resolved === CLIENT_INDEX) return opts.clientBuild;
    return realExists(p);
  });
  const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
    if (opts.writeThrows) throw new Error('EROFS: read-only file system');
  });
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});

  jest.resetModules();
  // Import express from the SAME fresh registry the server will use so the
  // response prototype we stub is the one the app's responses inherit from.
  const express = (await import('express')).default;
  const sendFileSpy = jest
    .spyOn(express.response, 'sendFile')
    .mockImplementation(function (this: any, p: string) {
      this.status(200).type('text/plain').send(`sendFile:${p}`);
    } as any);
  const mod = await import('../server.ts');
  return { app: mod.default, writeSpy, warnSpy, sendFileSpy };
}

describe('ensureDevBuildInfo (import-time)', () => {
  it('writes a DEV-LOCAL build-info.json in dev when the file is missing', async () => {
    const { app, writeSpy } = await loadServer({ nodeEnv: 'development', buildInfoExists: false, clientBuild: true });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const [target, body] = writeSpy.mock.calls[0]!;
    expect(target).toBe(BUILD_INFO_PATH);
    const parsed = JSON.parse(String(body));
    expect(parsed).toEqual({ repoUrl: null, commitHash: 'DEV-LOCAL', builtAt: expect.any(String) });

    // The file still "doesn't exist" (write was stubbed), so the endpoint
    // synthesizes the DEV-LOCAL payload itself.
    const res = await request(app).get('/api/build-info');
    expect(res.body.commitHash).toBe('DEV-LOCAL');
  });

  it('warns (and still boots) when the dev build-info.json cannot be written', async () => {
    const { app, warnSpy } = await loadServer({
      nodeEnv: 'development',
      buildInfoExists: false,
      clientBuild: false,
      writeThrows: true,
    });
    expect(warnSpy).toHaveBeenCalledWith('Could not create dev build-info.json:', 'EROFS: read-only file system');
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(200);
  });

  it('does not write build-info.json when it already exists', async () => {
    const { writeSpy } = await loadServer({ nodeEnv: 'development', buildInfoExists: true, clientBuild: true });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('does not write build-info.json in production with a client build', async () => {
    const { writeSpy } = await loadServer({ nodeEnv: 'production', buildInfoExists: false, clientBuild: true });
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe('loadBuildInfo without build-info.json', () => {
  it('returns all nulls in production when a client build is present', async () => {
    const { app } = await loadServer({ nodeEnv: 'production', buildInfoExists: false, clientBuild: true });
    const res = await request(app).get('/api/build-info');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ repoUrl: null, commitHash: null, builtAt: null });
  });

  it('returns DEV-LOCAL in production when there is no client build', async () => {
    const { app } = await loadServer({ nodeEnv: 'production', buildInfoExists: false, clientBuild: false });
    const res = await request(app).get('/api/build-info');
    expect(res.body.commitHash).toBe('DEV-LOCAL');
    expect(typeof res.body.builtAt).toBe('string');
  });
});

describe('SPA fallback', () => {
  it('serves client/dist/index.html for unknown non-API routes when a client build exists', async () => {
    const { app, sendFileSpy } = await loadServer({ nodeEnv: 'production', buildInfoExists: true, clientBuild: true });
    const res = await request(app).get('/some/deep/client/route');
    expect(res.status).toBe(200);
    expect(res.text).toBe(`sendFile:${CLIENT_INDEX}`);
    expect(sendFileSpy).toHaveBeenCalledTimes(1);
  });

  it('serves public/index.html for unknown non-API routes when there is no client build', async () => {
    const { app } = await loadServer({ nodeEnv: 'development', buildInfoExists: true, clientBuild: false });
    const res = await request(app).get('/author/@someone');
    expect(res.status).toBe(200);
    expect(res.text).toBe(`sendFile:${PUBLIC_INDEX}`);
  });

  it('never falls through to the SPA for unknown /api/* routes', async () => {
    const { app, sendFileSpy } = await loadServer({ nodeEnv: 'production', buildInfoExists: true, clientBuild: true });
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(sendFileSpy).not.toHaveBeenCalled();
  });
});
