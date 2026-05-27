import { test, expect } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';

/**
 * E2E coverage for the virtual "Unknown artist" category (fringematrix5-obvh).
 *
 * Flow:
 *   1. Open #authors (the all-artists index).
 *   2. The pinned "Unknown artist" card renders at the top of the grid.
 *   3. Clicking it navigates to #authors/__unknown__.
 *   4. AuthorDetail renders the "Unknown artist" header, no Twitter link,
 *      and the per-image "X images" count from the server.
 *
 * The stable route shape `#authors/__unknown__` is documented here so the
 * dependent beads (fringematrix5-0y9l, fringematrix5-zh88) can rely on it.
 *
 * Environments without BLOB_READ_WRITE_TOKEN still load the data files —
 * /api/authors and /api/authors/__unknown__ are computed from the on-disk
 * attribution data, not the blob store. So unlike the @Zort70 fixture, this
 * spec does NOT need an env-based skip; the server always returns a non-zero
 * unknownCount today.
 */

test.describe('Unknown artist category (fringematrix5-obvh)', () => {
  test('all-artists page shows the pinned Unknown artist card', async ({ page }) => {
    await page.goto('/#authors');
    await waitForLoaderToFinish(page);

    const card = page.locator('[data-testid="unknown-artist-card"]');
    await expect(card).toBeVisible();
    // Pinned at the top of the grid (first child).
    const firstChild = page.locator('[data-testid="authors-grid"] > *').first();
    await expect(firstChild).toHaveAttribute('data-testid', 'unknown-artist-card');
  });

  test('clicking the card navigates to #authors/__unknown__ and shows the detail page', async ({
    page,
  }) => {
    await page.goto('/#authors');
    await waitForLoaderToFinish(page);

    const card = page.locator('[data-testid="unknown-artist-card"]');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /Open Unknown artist/ }).click();

    // URL hash flips to the documented stable route.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(
      '#authors/__unknown__',
    );

    // Detail page renders the synthetic header.
    await expect(page.getByRole('heading', { name: 'Unknown artist' })).toBeVisible();
    await expect(page.getByText(/images without resolved attribution/i)).toBeVisible();

    // No Twitter link is rendered for the synthetic author.
    await expect(
      page.locator('.author-detail-header').getByRole('link'),
    ).toHaveCount(0);

    // At least one unattributed image is listed (current dataset has hundreds).
    const grid = page.getByLabel('Unattributed images');
    await expect(grid).toBeVisible();
    await expect(grid.locator('img')).not.toHaveCount(0);
  });

  test('deep-linking #authors/__unknown__ directly loads the unknown gallery', async ({
    page,
  }) => {
    await page.goto('/#authors/__unknown__');
    await waitForLoaderToFinish(page);
    await expect(page.getByRole('heading', { name: 'Unknown artist' })).toBeVisible();
  });
});
