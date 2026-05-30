import fs from 'fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  getImageById,
  getImageByBlobPath,
  getAllImages,
  resetImagesCache,
} from '../images.ts';

// ---------------------------------------------------------------------------
// Tests for server/images.ts — the image registry data-access module.
//
// These run against the real on-disk data/images.json, so they double as a
// smoke test that the registry produced by scripts/images-init.mjs is well
// formed and reachable from the server module's PROJECT_ROOT.
// ---------------------------------------------------------------------------

const KNOWN_BLOB_PATH =
  'avatars/Season4/AcrossTheUniverse/ATU-Cheribot/AtU_amber.jpg';

beforeEach(() => {
  resetImagesCache();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getAllImages()', () => {
  it('returns a non-empty registry keyed by id with the expected record shape', () => {
    const images = getAllImages();
    const ids = Object.keys(images);
    expect(ids.length).toBeGreaterThan(0);

    const rec = images[ids[0]!]!;
    expect(typeof rec.blobPath).toBe('string');
    expect(rec.blobPath.startsWith('avatars/')).toBe(true);
    expect(['active', 'deleted']).toContain(rec.status);
    expect(typeof rec.addedAt).toBe('string');
  });

  it('caches so images.json is read only once across calls', () => {
    resetImagesCache();
    const fsSpy = jest.spyOn(fs, 'readFileSync');

    const a = getAllImages();
    const b = getAllImages();
    expect(b).toBe(a); // same reference — served from cache

    const reads = fsSpy.mock.calls.filter(
      ([p]) => typeof p === 'string' && p.toString().endsWith('images.json')
    ).length;
    expect(reads).toBe(1);
  });
});

describe('getImageByBlobPath()', () => {
  it('resolves a known blob path to a registry entry', () => {
    const entry = getImageByBlobPath(KNOWN_BLOB_PATH);
    expect(entry).not.toBeNull();
    expect(typeof entry!.id).toBe('string');
    expect(entry!.record.blobPath).toBe(KNOWN_BLOB_PATH);
  });

  it('round-trips id -> record via getImageById', () => {
    const entry = getImageByBlobPath(KNOWN_BLOB_PATH);
    const byId = getImageById(entry!.id);
    expect(byId).toEqual(entry!.record);
  });

  it('returns null for an unknown blob path', () => {
    expect(getImageByBlobPath('avatars/Nope/missing.jpg')).toBeNull();
  });

  it('returns null for empty/whitespace input', () => {
    expect(getImageByBlobPath('')).toBeNull();
    expect(getImageByBlobPath('   ')).toBeNull();
  });
});

describe('getImageById()', () => {
  it('returns null for unknown ids and blank input', () => {
    expect(getImageById('not-a-real-id')).toBeNull();
    expect(getImageById('')).toBeNull();
  });
});
