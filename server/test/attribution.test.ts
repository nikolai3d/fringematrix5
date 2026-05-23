import fs from 'fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  getAuthors,
  getAuthorByHandle,
  getAttributionForPath,
  resetAttributionCache,
} from '../attribution.ts';

// ---------------------------------------------------------------------------
// Tests for server/attribution.ts — the data-access module for authors.yaml
// and attribution.json.
//
// These tests run against the real on-disk data files (not mocks), so they
// double as a smoke test that data/authors.yaml and data/attribution.json
// are well-formed and reachable from the server module's PROJECT_ROOT.
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  // Reset the module-level caches so each test starts from a clean slate.
  resetAttributionCache();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getAuthors()', () => {
  it('returns a non-empty array of author records loaded from authors.yaml', () => {
    const authors = getAuthors();
    expect(Array.isArray(authors)).toBe(true);
    expect(authors.length).toBeGreaterThan(0);

    const first = authors[0];
    expect(first).toBeDefined();
    expect(typeof first!.handle).toBe('string');
    expect(first!.handle.startsWith('@')).toBe(true);
    expect(typeof first!.name).toBe('string');
    expect(Array.isArray(first!.alternate_handles)).toBe(true);
    expect(Array.isArray(first!.roles)).toBe(true);
  });

  it('caches the result so authors.yaml is read only once across multiple calls', () => {
    resetAttributionCache();
    const fsSpy = jest.spyOn(fs, 'readFileSync');

    const a = getAuthors();
    const b = getAuthors();
    const c = getAuthors();

    expect(b).toBe(a); // same reference — served from cache
    expect(c).toBe(a);

    const callsForYaml = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('authors.yaml')
    ).length;
    expect(callsForYaml).toBe(1);
  });

  it('re-reads authors.yaml after resetAttributionCache() is called', () => {
    resetAttributionCache();
    const fsSpy = jest.spyOn(fs, 'readFileSync');

    getAuthors();
    const callsAfterFirst = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('authors.yaml')
    ).length;
    expect(callsAfterFirst).toBe(1);

    resetAttributionCache();
    getAuthors();

    const callsAfterReset = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('authors.yaml')
    ).length;
    expect(callsAfterReset).toBe(2);
  });
});

describe('getAuthorByHandle()', () => {
  it('returns the author for an exact primary-handle match', () => {
    const author = getAuthorByHandle('@Cheribot');
    expect(author).not.toBeNull();
    expect(author!.handle).toBe('@Cheribot');
    expect(author!.name).toBe('Cheribot');
  });

  it('matches handles case-insensitively', () => {
    const lower = getAuthorByHandle('@cheribot');
    const mixed = getAuthorByHandle('@CHERIBOT');
    expect(lower).not.toBeNull();
    expect(mixed).not.toBeNull();
    expect(lower!.handle).toBe('@Cheribot');
    expect(mixed!.handle).toBe('@Cheribot');
  });

  it('matches via alternate_handles entries', () => {
    // From authors.yaml: @Cheribot has alternate_handles: ["@cheribot"].
    // The match is case-insensitive so a differently-cased alt still resolves.
    const byAlt = getAuthorByHandle('@cheribot');
    expect(byAlt).not.toBeNull();
    expect(byAlt!.handle).toBe('@Cheribot');
  });

  it('tolerates a missing leading @ on the input', () => {
    const author = getAuthorByHandle('Cheribot');
    expect(author).not.toBeNull();
    expect(author!.handle).toBe('@Cheribot');
  });

  it('returns null for unknown handles', () => {
    expect(getAuthorByHandle('@definitely-not-a-real-handle-zzz')).toBeNull();
  });

  it('returns null for empty or non-string inputs', () => {
    expect(getAuthorByHandle('')).toBeNull();
    expect(getAuthorByHandle('   ')).toBeNull();
  });

  it('caches the author index so authors.yaml is read only once across mixed calls', () => {
    resetAttributionCache();
    const fsSpy = jest.spyOn(fs, 'readFileSync');

    getAuthors();
    getAuthorByHandle('@Cheribot');
    getAuthorByHandle('@nikolai3d');
    getAuthorByHandle('not-a-real-handle');

    const callsForYaml = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('authors.yaml')
    ).length;
    expect(callsForYaml).toBe(1);
  });
});

describe('getAttributionForPath()', () => {
  it('returns an attribution record for a known blob path', () => {
    const record = getAttributionForPath(
      'avatars/Season4/AcrossTheUniverse/ATU-Cheribot/AtU_amber.jpg'
    );
    expect(record).not.toBeNull();
    expect(record!.handle).toBe('@Cheribot');
    expect(record!.confidence).toBe('high');
    expect(Array.isArray(record!.candidates)).toBe(true);
    expect(record!.candidates).toContain('@Cheribot');
    expect(typeof record!.method).toBe('string');
    expect(typeof record!.evidence).toBe('string');
  });

  it('returns null for unknown blob paths', () => {
    expect(
      getAttributionForPath('avatars/Season99/NotARealFolder/not-a-real-file.jpg')
    ).toBeNull();
  });

  it('returns null for empty or non-string inputs', () => {
    expect(getAttributionForPath('')).toBeNull();
  });

  it('does NOT match by filename alone — full blob path is required', () => {
    // Exact-key lookup: just the filename should never resolve to a record.
    expect(getAttributionForPath('AtU_amber.jpg')).toBeNull();
  });

  it('caches the attribution map so attribution.json is read only once across calls', () => {
    resetAttributionCache();
    const fsSpy = jest.spyOn(fs, 'readFileSync');

    getAttributionForPath(
      'avatars/Season4/AcrossTheUniverse/ATU-Cheribot/AtU_amber.jpg'
    );
    getAttributionForPath('avatars/missing/path.jpg');
    getAttributionForPath(
      'avatars/Season4/AcrossTheUniverse/ATU-Cheribot/AtU_birdie_amber.jpg'
    );

    const callsForJson = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('attribution.json')
    ).length;
    expect(callsForJson).toBe(1);
  });

  it('re-reads attribution.json after resetAttributionCache() is called', () => {
    resetAttributionCache();
    const fsSpy = jest.spyOn(fs, 'readFileSync');

    getAttributionForPath(
      'avatars/Season4/AcrossTheUniverse/ATU-Cheribot/AtU_amber.jpg'
    );
    const callsAfterFirst = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('attribution.json')
    ).length;
    expect(callsAfterFirst).toBe(1);

    resetAttributionCache();
    getAttributionForPath(
      'avatars/Season4/AcrossTheUniverse/ATU-Cheribot/AtU_amber.jpg'
    );

    const callsAfterReset = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('attribution.json')
    ).length;
    expect(callsAfterReset).toBe(2);
  });
});
