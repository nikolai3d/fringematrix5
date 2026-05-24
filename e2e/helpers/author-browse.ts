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
 *
 * Resolution rules:
 *   - If the gallery grid renders, returns the thumbnail count (== the
 *     count the lightbox counter should reflect).
 *   - If the page renders the explicit empty-state status instead (i.e. the
 *     backend returned 0 attributed images for @Zort70, which in practice
 *     happens when `BLOB_READ_WRITE_TOKEN` is absent and the live blob
 *     listings are empty), this helper calls `test.skip` and never returns —
 *     `test.skip(true, …)` aborts the current test.
 *   - If neither shows up before the timeout, the underlying `expect.poll`
 *     fails the test — we deliberately do NOT swallow that, so real
 *     regressions (e.g. AuthorDetail failing to render, backend errors)
 *     surface as failures instead of being masked as environment skips.
 */
export async function gotoZortAuthorDetail(page: Page): Promise<number> {
  await page.goto(`/${ZORT_HASH}`);
  await waitForLoaderToFinish(page);

  const grid = page.locator('[data-testid="author-images-grid"]');
  // The "No images attributed to this artist yet." status div rendered by
  // AuthorDetail.tsx when `data.images.length === 0`. Using this explicit
  // empty-state signal lets us distinguish the empty-backend case from a
  // render failure, so the helper skips only when the backend positively
  // confirmed "no images" rather than swallowing all timeouts.
  const emptyStatus = page
    .locator('.authors-status')
    .filter({ hasText: /no images attributed/i });

  // Wait until exactly one of the two terminal states appears. If neither
  // does within the timeout, let the poll fail — that's a real regression,
  // not an environment skip.
  await expect
    .poll(
      async () =>
        (await grid.count()) > 0 || (await emptyStatus.count()) > 0,
      { timeout: 15_000 },
    )
    .toBe(true);

  if ((await emptyStatus.count()) > 0 && (await grid.count()) === 0) {
    test.skip(
      true,
      'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing). ' +
        'AuthorDetail rendered the empty-state status.',
    );
  }

  return grid.locator('.card img').count();
}
