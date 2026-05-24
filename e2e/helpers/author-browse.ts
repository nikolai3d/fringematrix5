import { expect, test, type Page } from '@playwright/test';
import { waitForLoaderToFinish } from './wireframe';

/**
 * Shared @Zort70 fixture for author-browse e2e specs.
 *
 * Per server/test/api.test.ts the @Zort70 handle has ~98 attributed images
 * spread across multiple seed campaigns — useful for exercising the
 * author-browse flow's cross-campaign behavior.
 *
 * Environments without BLOB_READ_WRITE_TOKEN return an empty author list;
 * `gotoZortAuthorDetail` calls `test.skip` itself in that case so callers
 * don't have to remember the gate.
 */
export const ZORT_HANDLE = '@Zort70';
export const ZORT_HASH = `#authors/${encodeURIComponent(ZORT_HANDLE)}`;

/**
 * Navigate to the @Zort70 author detail page and wait for it to populate.
 * Returns the number of thumbnails in the grid (== the count the lightbox
 * counter should reflect).
 *
 * When the environment has no blob token the grid comes back empty; this
 * helper calls `test.skip` with a descriptive reason and returns 0. Callers
 * can still branch on `total === 0` if they want, but the skip is already
 * owned here so they don't need to.
 */
export async function gotoZortAuthorDetail(page: Page): Promise<number> {
  await page.goto(`/${ZORT_HASH}`);
  await waitForLoaderToFinish(page);

  // The grid only renders once the /api/authors/@Zort70 fetch resolves with
  // images. In empty-blob environments the page shows the "no images" status
  // and the grid never appears — wait with a short escape hatch by polling
  // the count directly.
  const grid = page.locator('[data-testid="author-images-grid"]');
  await expect.poll(
    async () => (await grid.count()) > 0,
    { timeout: 15_000 }
  ).toBe(true).catch(() => {
    // fall through — count will read 0 and we'll skip below
  });

  const cards = grid.locator('.card img');
  const total = await cards.count();
  if (total === 0) {
    test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
  }
  return total;
}
