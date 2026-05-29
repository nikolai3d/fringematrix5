import { test, expect, Page, Locator } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';
import { gotoZortAuthorDetail } from './helpers/author-browse';

/**
 * E2E coverage for gallery grid virtualization (fringematrix5-utaj).
 *
 * GalleryGrid windows its cards: only the rows in/near the viewport are
 * rendered, with top/bottom spacer rows reserving the scrolled-out space. The
 * same grid backs both the campaign gallery and the author-detail page.
 *
 * These tests verify:
 *   (a) a large list renders only a windowed subset of cards (with a bottom
 *       spacer reserving the rest), and
 *   (b) opening the lightbox at an off-screen index (after scrolling down the
 *       list) still works — the target card is mounted, its rect is read for
 *       the zoom, and the lightbox shows the image with a HUD index well past
 *       the first viewport.
 *
 * Data sourcing: campaign galleries need BLOB_READ_WRITE_TOKEN to be non-empty,
 * so the campaign test skips in token-less environments. The author-detail
 * grid for @Zort70 (~98 images) is backed by seed data and exercises the same
 * windowing component, so the off-screen-open test runs there and only skips
 * when the author list itself is empty / too small.
 */

const SPACER_BOTTOM = '[data-testid="gallery-grid-spacer-bottom"]';
const SPACER_TOP = '[data-testid="gallery-grid-spacer-top"]';

/** Navigate to the default gallery and wait for it to settle. */
async function gotoGallery(page: Page) {
  await page.goto('/');
  await waitForLoaderToFinish(page);
}

test.describe('Gallery grid virtualization (fringematrix5-utaj)', () => {
  test('campaign gallery renders only a windowed subset for a large campaign', async ({ page }) => {
    await gotoGallery(page);

    const cards = page.locator('.gallery-grid .card');
    if ((await cards.count()) === 0) {
      test.skip(true, 'No campaign images available (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    // Windowing is active only when there are more rows than fit the viewport,
    // signalled by a bottom spacer. Skip small campaigns — nothing to window.
    const bottomSpacer = page.locator(SPACER_BOTTOM);
    if ((await bottomSpacer.count()) === 0) {
      test.skip(true, 'Active campaign is too small to trigger windowing.');
    }

    const spacerHeight = await bottomSpacer.evaluate((el) => el.getBoundingClientRect().height);
    expect(spacerHeight).toBeGreaterThan(0);
    // At scroll top there must be no top spacer.
    await expect(page.locator(SPACER_TOP)).toHaveCount(0);
    // The document scrolls beyond one viewport (spacer reserves unrendered rows).
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const innerHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeGreaterThan(innerHeight);
  });

  test('author grid windows a large list and opens the lightbox at an off-screen index', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page); // skips if empty
    const grid = page.locator('[data-testid="author-images-grid"]');

    // Need enough images to actually window. If the bottom spacer is absent the
    // whole list fits the viewport — nothing to virtualize, so skip.
    const bottomSpacer = grid.locator(SPACER_BOTTOM);
    if ((await bottomSpacer.count()) === 0) {
      test.skip(true, `Author list (${total}) is too small to trigger windowing.`);
    }

    // Windowed: fewer cards mounted than the author's full total.
    const mountedAtTop = await grid.locator('.card img').count();
    expect(mountedAtTop).toBeGreaterThan(0);
    expect(mountedAtTop).toBeLessThan(total);

    // Scroll to the bottom so the last rows mount and the early rows window out.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    await expect(grid.locator(SPACER_TOP)).toHaveCount(1);

    // Click the last currently-rendered card — an index well past the first
    // viewport, i.e. one that was virtualized out at the start.
    const imgs = grid.locator('.card img');
    const n = await imgs.count();
    expect(n).toBeGreaterThan(0);
    const lastImg: Locator = imgs.nth(n - 1);
    await lastImg.scrollIntoViewIfNeeded();
    await lastImg.click();

    // The lightbox opens and shows the image (not stuck invisible): proves the
    // off-screen card's rect was readable for the open animation.
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();
    await expect(page.locator('#lightbox-image')).toBeVisible();

    // HUD index well past 1 confirms we opened at a high, off-screen index.
    const hud = page.locator('.lightbox-hud');
    await expect(hud).toBeVisible();
    const text = (await hud.textContent()) ?? '';
    const match = text.match(/(\d+)\s+OF\s+(\d+)/);
    expect(match, `HUD text "${text}" did not match "N OF M"`).not.toBeNull();
    const current = Number(match![1]);
    expect(Number(match![2])).toBe(total);
    expect(current).toBeGreaterThan(1);

    // Close cleanly (exercises the close/zoom path back to the off-screen thumb,
    // which the forceMountIndex pin keeps mounted).
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
  });
});
