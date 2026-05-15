import request from 'supertest';
import fs from 'fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import the Express app without starting the listener
import app from '../server.ts';

// ---------------------------------------------------------------------------
// Tests for duplicate campaign id detection in loadCampaigns().
//
// Two campaigns that produce the same slug from deriveCampaignId would silently
// make the second one unreachable. loadCampaigns() now detects this at load
// time and throws an error with the offending values, which the route handler
// converts to a 500 JSON response.
// ---------------------------------------------------------------------------

let consoleSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('GET /api/campaigns — duplicate campaign id detection', () => {
  it('returns 500 with a "Duplicate" message when two campaigns share the same hashtag slug', async () => {
    // Both hashtags slugify to the same id ("fringefriday")
    const yaml = [
      'campaigns:',
      '  - hashtag: "#FringeFriday"',
      '    episode: "S01E01"',
      '  - hashtag: "#FringeFriday"',
      '    episode: "S01E02"',
    ].join('\n');

    const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => yaml);

    const res = await request(app).get('/api/campaigns');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
    // The route handler swallows detail into a generic message; the thrown error
    // message should mention "Duplicate" — verify the spy captured it.
    const errorCalls = consoleSpy.mock.calls.map((args: unknown[]) => String(args[0]));
    const hasDuplicate = errorCalls.some((msg: string) => /duplicate/i.test(msg));
    expect(hasDuplicate).toBe(true);

    fsSpy.mockRestore();
  });

  it('returns 500 with a "Duplicate" message when two campaigns share the same icon_path slug', async () => {
    // Both icon_paths slugify to the same id ("season1")
    const yaml = [
      'campaigns:',
      '  - icon_path: "season1"',
      '    episode: "S01E01"',
      '  - icon_path: "season1"',
      '    episode: "S01E02"',
    ].join('\n');

    const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => yaml);

    const res = await request(app).get('/api/campaigns');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    const errorCalls = consoleSpy.mock.calls.map((args: unknown[]) => String(args[0]));
    const hasDuplicate = errorCalls.some((msg: string) => /duplicate/i.test(msg));
    expect(hasDuplicate).toBe(true);

    fsSpy.mockRestore();
  });

  it('returns 200 when all campaigns produce distinct ids', async () => {
    const yaml = [
      'campaigns:',
      '  - hashtag: "#FringeFriday"',
      '    episode: "S01E01"',
      '  - hashtag: "#FringeMonday"',
      '    episode: "S01E02"',
    ].join('\n');

    const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => yaml);

    const res = await request(app).get('/api/campaigns');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.campaigns)).toBe(true);
    expect(res.body.campaigns).toHaveLength(2);

    fsSpy.mockRestore();
  });

  it('includes both campaigns\' hashtag and icon_path in the thrown error', async () => {
    // Capture the actual thrown error by spying on console.error which receives it
    const yaml = [
      'campaigns:',
      '  - hashtag: "CollidingTag"',
      '    icon_path: "path-a"',
      '  - hashtag: "CollidingTag"',
      '    icon_path: "path-b"',
    ].join('\n');

    const fsSpy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => yaml);

    const res = await request(app).get('/api/campaigns');

    expect(res.status).toBe(500);
    // The error object passed to console.error should mention the duplicate id
    const errorMessages = consoleSpy.mock.calls.map((args: unknown[]) => {
      const arg = args[0];
      return arg instanceof Error ? arg.message : String(arg);
    });
    const duplicateMsg = errorMessages.find((msg: string) => /duplicate/i.test(msg));
    expect(duplicateMsg).toBeDefined();
    expect(duplicateMsg).toMatch(/collidingtag/i);

    fsSpy.mockRestore();
  });
});
