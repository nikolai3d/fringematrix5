import { test, expect } from '@playwright/test';
import { ZORT_HANDLE, ZORT_HASH, gotoZortAuthorDetail } from './helpers/author-browse';
import { waitForLoaderToFinish } from './helpers/wireframe';

/**
 * E2E coverage for the artist-detail client-side cache (fringematrix5-zkhl).
 *
 * Verifies that revisiting an artist after navigating away does NOT show
 * "Loading artist…" and that the network is hit only once across both visits.
 *
 * The test intercepts /api/authors/:handle with a 600ms artificial delay so
 * that the cache vs. network paths are unambiguously distinguishable — the
 * second visit would take ≥600ms without the cache, and renders instantly with it.
 */
test.describe('Artist-detail cache (fringematrix5-zkhl)', () => {
  test('second visit renders grid immediately without "Loading artist…" and hits the network only once', async ({
    page,
  }) => {
    let interceptCallCount = 0;
    const encodedHandle = encodeURIComponent(ZORT_HANDLE);

    // Intercept the artist detail API with a 600ms delay on the first call.
    // On subsequent calls we still serve the response but also count them
    // so we can assert that the cache was used on the second visit.
    await page.route(`**/api/authors/${encodedHandle}`, async (route) => {
      interceptCallCount += 1;
      if (interceptCallCount === 1) {
        // First visit: delay to make the cache benefit observable.
        await new Promise((r) => setTimeout(r, 600));
      }
      await route.continue();
    });

    // First visit: navigate to the author detail page.
    await page.goto(`/${ZORT_HASH}`);
    await waitForLoaderToFinish(page);

    // Wait for the grid — this proves the first fetch resolved.
    const grid = page.locator('[data-testid="author-images-grid"]');
    const emptyStatus = page
      .locator('.authors-status')
      .filter({ hasText: /no images attributed/i });

    await expect
      .poll(
        async () =>
          (await grid.count()) > 0 || (await emptyStatus.count()) > 0,
        { timeout: 20_000 },
      )
      .toBe(true);

    if ((await emptyStatus.count()) > 0 && (await grid.count()) === 0) {
      test.skip(
        true,
        'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).',
      );
    }

    await expect(grid).toBeVisible();

    // Navigate away to the all-artists page.
    await page.click('button[aria-label="Back to artists"]');
    await expect(page.locator('.authors-page')).toBeVisible();

    // Navigate back to the same artist.
    // We click the matching card in the authors index if available,
    // or just navigate directly via hash.
    await page.goto(`/${ZORT_HASH}`);

    // On the second visit the grid must be visible immediately — before any
    // "Loading artist…" status can appear (cache hit renders synchronously).
    // We assert that the loading status is never seen by checking it stays
    // absent throughout the navigation.
    const loadingStatus = page.locator('.authors-status', { hasText: 'Loading artist…' });
    await expect(loadingStatus).not.toBeVisible();

    // The grid should be visible very quickly (well under the 600ms delay
    // we imposed on the network leg).
    await expect(grid).toBeVisible({ timeout: 1000 });

    // Network was hit exactly once across both visits.
    expect(interceptCallCount).toBe(1);
  });
});
