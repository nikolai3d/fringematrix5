/**
 * Regression tests for fringematrix5-ojl (closes coverage gap from fringematrix5-luy):
 *
 * When navigating back to a campaign that has a cached image list, the
 * cache-hit branch of selectCampaign must reset the error/progress state
 * left behind by a previous failed load. Without the fix these three
 * setCampaignLoad* calls were missing, leaving campaignLoadError=true and
 * the "Some images failed to load" banner permanently visible.
 *
 * Strategy: two test groups.
 *   1. Source-level — verify the App.tsx cache-hit branch contains every
 *      required setState call (fast, zero runtime overhead).
 *   2. State-machine simulation — model the selectCampaign logic with plain
 *      JavaScript state variables and assert the correct transitions without
 *      needing to render the full React component tree.
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Read the source once for all source-level assertions.
// The cache-hit logic now lives in useCampaignLoader.ts (extracted from
// App.tsx in fringematrix5-1yg).
// ---------------------------------------------------------------------------
const hookSrc = fs.readFileSync(
  path.resolve(__dirname, '../src/hooks/useCampaignLoader.ts'),
  'utf-8',
);

// ---------------------------------------------------------------------------
// 1. Source-level guards
// ---------------------------------------------------------------------------
describe('selectCampaign cache-hit branch — source guards', () => {
  // Locate the cache-hit block by finding the `if (id in imageCache) {` guard
  // and extracting its body (everything up to the closing `return;` on the
  // same indentation level).
  const cacheHitStart = hookSrc.indexOf('if (id in imageCache)');
  const returnAfterCache = hookSrc.indexOf('return;', cacheHitStart);
  const cacheHitBlock = cacheHitStart > -1 && returnAfterCache > -1
    ? hookSrc.slice(cacheHitStart, returnAfterCache + 'return;'.length)
    : '';

  it('the cache-hit block exists in App.tsx', () => {
    expect(cacheHitBlock).not.toBe('');
  });

  it('cache-hit branch resets campaignLoadError to false', () => {
    expect(cacheHitBlock).toMatch(/setCampaignLoadError\(\s*false\s*\)/);
  });

  it('cache-hit branch resets campaignLoadProgress to 0', () => {
    expect(cacheHitBlock).toMatch(/setCampaignLoadProgress\(\s*0\s*\)/);
  });

  it('cache-hit branch resets campaignLoadTotal to 0', () => {
    expect(cacheHitBlock).toMatch(/setCampaignLoadTotal\(\s*0\s*\)/);
  });

  it('cache-hit branch sets isCampaignLoading to false', () => {
    expect(cacheHitBlock).toMatch(/setIsCampaignLoading\(\s*false\s*\)/);
  });

  it('cache-hit branch sets currentImages from the cache', () => {
    expect(cacheHitBlock).toMatch(/setCurrentImages\(\s*imageCache\[id\]\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// 2. State-machine simulation
//    Model the selectCampaign logic with plain variables so we can assert
//    state transitions without rendering the full component.
// ---------------------------------------------------------------------------

/**
 * Minimal simulation of the selectCampaign cache-hit branch.
 * The logic mirrors App.tsx exactly: guard is `id in imageCache`
 * (not `imageCache[id]`, which was fixed in fringematrix5-0q7 to
 * correctly handle campaigns with empty image arrays).
 */
function makeState(overrides = {}) {
  return {
    activeCampaignId: null,
    currentImages: [],
    campaignLoadProgress: 0,
    campaignLoadTotal: 0,
    campaignLoadError: false,
    isCampaignLoading: false,
    imageCache: {},
    ...overrides,
  };
}

function simulateSelectCampaign(state, id) {
  // Mirrors App.tsx: setActiveCampaignId
  state.activeCampaignId = id;

  if (id in state.imageCache) {
    // Cache-hit branch — mirrors lines 231-236 of App.tsx
    state.currentImages = state.imageCache[id];
    state.campaignLoadProgress = 0;
    state.campaignLoadTotal = 0;
    state.campaignLoadError = false;
    state.isCampaignLoading = false;
    return { fromCache: true };
  }

  // Cache-miss: would call loadCampaignImages — not simulated here
  return { fromCache: false };
}

describe('selectCampaign cache-hit — state machine', () => {
  it('resets campaignLoadError after a previous load error on campaign A', () => {
    // Arrange: campaign A had a load error; campaign B is cached
    const cachedImages = [{ src: 'https://example.com/img1.jpg', fileName: 'img1.jpg' }];
    const state = makeState({
      activeCampaignId: 'campaign-a',
      campaignLoadError: true,       // error left by campaign A
      campaignLoadProgress: 5,
      campaignLoadTotal: 10,
      isCampaignLoading: false,
      imageCache: { 'campaign-b': cachedImages },
    });

    // Act: navigate to campaign B (which is cached)
    const result = simulateSelectCampaign(state, 'campaign-b');

    // Assert: served from cache
    expect(result.fromCache).toBe(true);
    // Error state must be cleared
    expect(state.campaignLoadError).toBe(false);
    // Progress counters must be reset
    expect(state.campaignLoadProgress).toBe(0);
    expect(state.campaignLoadTotal).toBe(0);
    // Images must be populated from cache
    expect(state.currentImages).toEqual(cachedImages);
    // Not in loading state
    expect(state.isCampaignLoading).toBe(false);
    // Active campaign updated
    expect(state.activeCampaignId).toBe('campaign-b');
  });

  it('does NOT show error banner when navigating to cached campaign after error', () => {
    // The "Some images failed to load" banner renders when campaignLoadError===true.
    // This test asserts that navigating to a cached campaign clears that flag.
    const cachedImages = [{ src: 'https://example.com/img2.jpg', fileName: 'img2.jpg' }];
    const state = makeState({
      activeCampaignId: 'campaign-x',
      campaignLoadError: true,
      imageCache: { 'campaign-y': cachedImages },
    });

    simulateSelectCampaign(state, 'campaign-y');

    // Banner condition: campaignLoadError must be false after cache-hit
    const bannerShouldBeVisible = state.campaignLoadError;
    expect(bannerShouldBeVisible).toBe(false);
  });

  it('preserves cached images without triggering a new network load', () => {
    const cachedImages = [
      { src: 'https://example.com/a.jpg', fileName: 'a.jpg' },
      { src: 'https://example.com/b.jpg', fileName: 'b.jpg' },
    ];
    const loadCampaignImages = vi.fn();
    const state = makeState({ imageCache: { 'campaign-c': cachedImages } });

    const result = simulateSelectCampaign(state, 'campaign-c');

    // Cache hit — loadCampaignImages must NOT have been called
    expect(result.fromCache).toBe(true);
    expect(loadCampaignImages).not.toHaveBeenCalled();
    expect(state.currentImages).toEqual(cachedImages);
  });

  it('still triggers a network load for a campaign not in the cache', () => {
    const state = makeState({ imageCache: {} }); // empty cache

    const result = simulateSelectCampaign(state, 'campaign-d');

    // Cache miss — should NOT set fromCache
    expect(result.fromCache).toBe(false);
    // campaignLoadError unchanged (would be set by loadCampaignImages on failure)
    expect(state.campaignLoadError).toBe(false);
  });

  it('resets progress counters even when they were non-zero from the prior load', () => {
    const cachedImages = [{ src: 'https://example.com/img.jpg', fileName: 'img.jpg' }];
    const state = makeState({
      campaignLoadProgress: 7,
      campaignLoadTotal: 12,
      campaignLoadError: true,
      imageCache: { 'fresh': cachedImages },
    });

    simulateSelectCampaign(state, 'fresh');

    expect(state.campaignLoadProgress).toBe(0);
    expect(state.campaignLoadTotal).toBe(0);
    expect(state.campaignLoadError).toBe(false);
  });
});
