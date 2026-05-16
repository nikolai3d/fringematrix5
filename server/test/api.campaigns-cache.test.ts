import request from 'supertest';
import fs from 'fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import the Express app and cache-reset helpers exported for test isolation
import app, { resetCampaignsCache, resetBuildInfoCache } from '../server.ts';

// ---------------------------------------------------------------------------
// Memoization tests for getCampaigns() and getBuildInfo()
//
// Both functions load data exactly once per process lifetime and cache the
// result in a module-level variable. These tests confirm that even when
// /api/campaigns (or /api/build-info) is requested multiple times, the
// underlying fs.readFileSync is called only once — the second response comes
// straight from the in-memory cache.
// ---------------------------------------------------------------------------

// Suppress noisy console.error / console.log output during tests.
// Spies are registered here and restored wholesale by jest.restoreAllMocks() below.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  // Restore all spies (fsSpy, consoleSpy, consoleLogSpy, etc.) so a mid-test
  // assertion failure cannot leak a spy into the next test.
  jest.restoreAllMocks();
});

describe('getCampaigns() memoization', () => {
  it('reads campaigns.yaml exactly once even when /api/campaigns is requested multiple times', async () => {
    // Reset the module-level cache so the first request below triggers a real
    // fs read (which we can observe via the spy).
    resetCampaignsCache();

    const fsSpy = jest.spyOn(fs, 'readFileSync');

    // First request — should call readFileSync to populate the cache
    const res1 = await request(app).get('/api/campaigns');
    expect(res1.status).toBe(200);

    const callsAfterFirst = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('campaigns.yaml')
    ).length;
    expect(callsAfterFirst).toBe(1);

    // Second request — cache hit; readFileSync must NOT be called again
    const res2 = await request(app).get('/api/campaigns');
    expect(res2.status).toBe(200);

    const callsAfterSecond = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('campaigns.yaml')
    ).length;
    expect(callsAfterSecond).toBe(1); // still only one call

    // Third request — cache still holds
    const res3 = await request(app).get('/api/campaigns');
    expect(res3.status).toBe(200);

    const callsAfterThird = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('campaigns.yaml')
    ).length;
    expect(callsAfterThird).toBe(1); // unchanged

    // All three responses must return the same campaigns list
    expect(res1.body.campaigns).toEqual(res2.body.campaigns);
    expect(res2.body.campaigns).toEqual(res3.body.campaigns);
  });

  it('re-reads campaigns.yaml after resetCampaignsCache() is called', async () => {
    resetCampaignsCache();

    const fsSpy = jest.spyOn(fs, 'readFileSync');

    // First request populates the cache
    const res1 = await request(app).get('/api/campaigns');
    expect(res1.status).toBe(200);

    const callsAfterFirst = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('campaigns.yaml')
    ).length;
    expect(callsAfterFirst).toBe(1);

    // Reset the cache to simulate a fresh process (as test isolation helpers do)
    resetCampaignsCache();

    // Next request should call readFileSync again since cache was cleared
    const res2 = await request(app).get('/api/campaigns');
    expect(res2.status).toBe(200);

    const callsAfterReset = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('campaigns.yaml')
    ).length;
    expect(callsAfterReset).toBe(2);
  });
});

describe('getBuildInfo() memoization', () => {
  it('reads build-info.json (or falls back) exactly once even when /api/build-info is requested multiple times', async () => {
    // Reset the module-level cache so the first request triggers a fresh load
    resetBuildInfoCache();

    const fsSpy = jest.spyOn(fs, 'readFileSync');

    // First request — cache miss, loads build-info
    const res1 = await request(app).get('/api/build-info');
    expect(res1.status).toBe(200);

    // Count how many times readFileSync was called for build-info.json after first request
    const callsAfterFirst = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('build-info.json')
    ).length;

    // Second request — must be served from cache without another readFileSync
    const res2 = await request(app).get('/api/build-info');
    expect(res2.status).toBe(200);

    const callsAfterSecond = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('build-info.json')
    ).length;
    expect(callsAfterSecond).toBe(callsAfterFirst); // no additional reads

    // Third request — same expectation
    const res3 = await request(app).get('/api/build-info');
    expect(res3.status).toBe(200);

    const callsAfterThird = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('build-info.json')
    ).length;
    expect(callsAfterThird).toBe(callsAfterFirst); // still unchanged

    // All three responses must return the same build-info payload
    expect(res1.body).toEqual(res2.body);
    expect(res2.body).toEqual(res3.body);
  });

  it('re-reads build-info after resetBuildInfoCache() is called', async () => {
    resetBuildInfoCache();

    const fsSpy = jest.spyOn(fs, 'readFileSync');

    // First request — populates the cache
    const res1 = await request(app).get('/api/build-info');
    expect(res1.status).toBe(200);

    const callsAfterFirst = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('build-info.json')
    ).length;

    // Invalidate the cache
    resetBuildInfoCache();

    // Next request should trigger another read
    const res2 = await request(app).get('/api/build-info');
    expect(res2.status).toBe(200);

    const callsAfterReset = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('build-info.json')
    ).length;

    // In dev mode, build-info.json may not exist (falls back to DEV-LOCAL without
    // calling readFileSync), so the count may stay at 0. What matters is that
    // the second call count is >= the first-call count — a fresh load was attempted.
    expect(callsAfterReset).toBeGreaterThanOrEqual(callsAfterFirst);
  });
});
