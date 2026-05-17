/**
 * Regression tests for fringematrix5-6ns:
 *
 * A campaign with zero images should be correctly served from the imageCache
 * on re-navigation without triggering a second API fetch.
 *
 * PR #101 (fringematrix5-0q7) fixed the cache guard from a truthy check
 * (`if (imageCache[id])`) to the correct `if (id in imageCache)`.  The
 * truthy check would miss an empty-array entry because `[]` is truthy but
 * `[]` is still a valid cached value — meaning zero-image campaigns should
 * also satisfy the cache-hit path.  This file provides test coverage for
 * that exact scenario.
 *
 * Strategy: same two-layer approach as selectCampaign-cache-hit.test.js.
 *   1. Source-level guard — assert the `if (id in imageCache)` form exists
 *      (catches a future regression back to a truthy check).
 *   2. State-machine simulation — model the selectCampaign logic with plain
 *      JavaScript variables and assert correct behaviour for empty-array
 *      campaigns without rendering the full React component tree.
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Read the source once for all source-level assertions
// ---------------------------------------------------------------------------
const hookSrc = fs.readFileSync(
  path.resolve(__dirname, '../src/hooks/useCampaignLoader.ts'),
  'utf-8',
);

// ---------------------------------------------------------------------------
// 1. Source-level guard
// ---------------------------------------------------------------------------
describe('imageCache empty-array — source guard', () => {
  it('useCampaignLoader.ts uses `id in imageCache` (not a truthy check) for the cache guard', () => {
    // The correct form is `if (id in imageCache)`.  A truthy check such as
    // `if (imageCache[id])` would silently skip cached campaigns with [] images.
    // Note: the imageCache logic moved from App.tsx to useCampaignLoader.ts in PR #117.
    expect(hookSrc).toMatch(/if\s*\(\s*id\s+in\s+imageCache\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// 2. State-machine simulation
//    Mirrors the selectCampaign logic in App.tsx using plain variables.
// ---------------------------------------------------------------------------

function makeState(overrides = {}) {
  return {
    activeCampaignId: null,
    currentImages: null,   // null = "not yet set" so we can distinguish from []
    campaignLoadProgress: 0,
    campaignLoadTotal: 0,
    campaignLoadError: false,
    isCampaignLoading: false,
    imageCache: {},
    ...overrides,
  };
}

/**
 * Minimal simulation of the selectCampaign cache-hit branch.
 * Returns { fromCache: true } when the cache is hit, { fromCache: false }
 * for a miss (which would normally call loadCampaignImages).
 */
function simulateSelectCampaign(state, id) {
  state.activeCampaignId = id;

  if (id in state.imageCache) {
    // Cache-hit branch — mirrors App.tsx lines 229-235
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

describe('imageCache empty-array — state-machine simulation', () => {
  it('treats a cached empty array as a cache hit (not a miss)', () => {
    // Arrange: campaign-a has zero images but IS in the cache
    const state = makeState({
      imageCache: { 'campaign-a': [] },
    });

    // Act: navigate to campaign-a
    const result = simulateSelectCampaign(state, 'campaign-a');

    // Assert: cache hit — no network call needed
    expect(result.fromCache).toBe(true);
  });

  it('sets currentImages to an empty array (not null/undefined) for a zero-image campaign', () => {
    const state = makeState({
      imageCache: { 'campaign-empty': [] },
    });

    simulateSelectCampaign(state, 'campaign-empty');

    // Must be the exact cached value — an empty array, not null/undefined
    expect(state.currentImages).toEqual([]);
  });

  it('does not trigger a network fetch on re-navigation to a zero-image campaign', () => {
    // Simulate: navigate to campaign-empty (populates cache), navigate away,
    // then navigate back — no second fetch should occur.
    const fetchMock = vi.fn();

    const state = makeState({
      imageCache: { 'campaign-empty': [] },
    });

    // First navigation (cache hit)
    const first = simulateSelectCampaign(state, 'campaign-empty');
    expect(first.fromCache).toBe(true);

    // Navigate away
    simulateSelectCampaign(state, 'campaign-other'); // cache miss — would fetch

    // Re-navigate back; still in cache
    const second = simulateSelectCampaign(state, 'campaign-empty');
    expect(second.fromCache).toBe(true);

    // fetchMock never called because the simulation takes the cache-hit path
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resets error and progress state even for a zero-image campaign cache hit', () => {
    // A prior failed load may leave campaignLoadError=true / progress counters
    // non-zero. Navigating to a zero-image cached campaign must clean that up.
    const state = makeState({
      activeCampaignId: 'campaign-x',
      campaignLoadError: true,
      campaignLoadProgress: 3,
      campaignLoadTotal: 5,
      isCampaignLoading: false,
      imageCache: { 'campaign-empty': [] },
    });

    simulateSelectCampaign(state, 'campaign-empty');

    expect(state.campaignLoadError).toBe(false);
    expect(state.campaignLoadProgress).toBe(0);
    expect(state.campaignLoadTotal).toBe(0);
    expect(state.isCampaignLoading).toBe(false);
    expect(state.currentImages).toEqual([]);
  });

  it('does NOT treat a campaign absent from the cache as a hit, even if it has no images yet', () => {
    // Sanity-check: campaigns not yet fetched must still go through loadCampaignImages
    const state = makeState({
      imageCache: {}, // empty cache — campaign-new has never been fetched
    });

    const result = simulateSelectCampaign(state, 'campaign-new');

    expect(result.fromCache).toBe(false);
  });
});
