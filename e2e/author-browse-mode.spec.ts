import { test, expect, Page } from '@playwright/test';

/**
 * E2E coverage for author-browse mode and the info-box in-app links that ride
 * on top of it (fringematrix5-e342, parent epic fringematrix5-7bx).
 *
 * The author-browse flow is:
 *   1. User opens an author detail page (#authors/@<handle>).
 *   2. Clicking a thumbnail opens the lightbox against that author's full
 *      image list — which may span multiple source campaigns.
 *   3. NEXT / ArrowRight cycles through the author's images. The IMAGE
 *      DETAILS sidebar resolves the source campaign per image (pyd), so
 *      EPISODE NAME / HASHTAG etc. update as the user crosses a campaign
 *      boundary.
 *   4. Closing the lightbox returns the user to the author detail page
 *      (URL hash unchanged).
 *
 * On top of that:
 *   - The AUTHOR row handle is an in-app button (4a6o) — clicking it from a
 *     lightbox image with a resolved author closes the lightbox and lands
 *     on that author's gallery page (#authors/<encoded-handle>).
 *   - The EPISODE NAME value is an in-app button (c320) — clicking it
 *     closes the lightbox and switches the gallery to that campaign
 *     (URL hash becomes #<campaignId>).
 *
 * We use @Zort70 as the fixture: per server/test/api.test.ts that handle has
 * ~98 attributed images, which the seed data spreads across multiple
 * campaigns. The exact count and ordering depend on the live blob store, so
 * the spec reads the count from the page rather than hard-coding it, and
 * iterates by index — never by file name — when checking that details update
 * across campaigns.
 *
 * Environments without BLOB_READ_WRITE_TOKEN return an empty author list;
 * following the project's existing convention we `test.skip` with a reason
 * in that case rather than failing.
 */

const ZORT_HANDLE = '@Zort70';
const ZORT_HASH = `#authors/${encodeURIComponent(ZORT_HANDLE)}`;

async function waitForLoaderToFinish(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }
}

/**
 * Navigate to the @Zort70 author detail page and wait for it to populate.
 * Returns the number of thumbnails in the grid (== the count the lightbox
 * counter should reflect). When the environment has no blob token the grid
 * comes back empty; the caller is expected to skip in that case.
 */
async function gotoZortAuthorDetail(page: Page): Promise<number> {
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
    // fall through — count will read 0 and the caller will skip
  });

  const cards = grid.locator('.card img');
  return cards.count();
}

/**
 * Read the lightbox HUD's "N OF M" counter as a {current, total} pair.
 * Asserts the HUD is in the expected shape so a regression in the HUD
 * format surfaces here rather than as a confusing downstream assertion.
 */
async function readCounter(page: Page): Promise<{ current: number; total: number }> {
  const hud = page.locator('.lightbox-hud');
  await expect(hud).toBeVisible();
  const text = (await hud.textContent()) ?? '';
  const match = text.match(/(\d+)\s+OF\s+(\d+)/);
  expect(match, `HUD text "${text}" did not match "N OF M"`).not.toBeNull();
  return { current: Number(match![1]), total: Number(match![2]) };
}

/**
 * Read the EPISODE NAME row value text (the in-app button label when
 * present, otherwise the plain text fallback). Scoped to the first
 * `.lightbox-details` instance so we don't pick up the mobile drawer copy.
 */
async function readEpisodeName(page: Page): Promise<string> {
  const sidebar = page.locator('.lightbox-details').first();
  // EPISODE NAME is the first .lightbox-details-row (heading is a sibling
  // div, not a row).
  const row = sidebar.locator('.lightbox-details-row').filter({ hasText: 'EPISODE NAME' }).first();
  const value = row.locator('.lightbox-details-value');
  return (await value.textContent())?.trim() ?? '';
}

test.describe('Author-browse mode — lightbox navigation', () => {
  test('clicking a thumbnail opens the lightbox with the author total as the counter', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    const grid = page.locator('[data-testid="author-images-grid"]');
    await grid.locator('.card img').first().click();

    await expect(page.locator('#lightbox')).toBeVisible();
    const counter = await readCounter(page);
    expect(counter.current).toBe(1);
    // The total reflects the author's full image list, NOT a single
    // campaign's image list — that's the whole point of author-browse mode.
    expect(counter.total).toBe(total);
  });

  test('ArrowRight cycles through the author list and the IMAGE DETAILS panel updates across campaigns', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }
    // We need to see at least one campaign boundary to verify the
    // per-image campaign resolution (pyd). @Zort70 is known to span
    // multiple campaigns, but if the fixture ever shrinks to a single
    // campaign this test would become a tautology — guard with a soft
    // floor that still leaves room for normal data drift.
    if (total < 2) test.skip(true, 'Need at least 2 images in the author list');

    const grid = page.locator('[data-testid="author-images-grid"]');
    await grid.locator('.card img').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();

    // Collect EPISODE NAME at each step. We bound the loop by the actual
    // total rather than a magic number so the spec adapts to fixture changes.
    // 25 is enough headroom to cross the BABM → other campaign boundary that
    // @Zort70 is known to straddle without making the spec slow.
    const seenEpisodes = new Set<string>();
    seenEpisodes.add(await readEpisodeName(page));

    const steps = Math.min(total - 1, 25);
    for (let i = 0; i < steps; i++) {
      await page.keyboard.press('ArrowRight');
      // Wait for the HUD's current index to actually advance before
      // sampling EPISODE NAME — otherwise on slower CI we'd read a stale
      // value from before the React state update flushed.
      const expectedCurrent = i + 2;
      await expect.poll(async () => (await readCounter(page)).current).toBe(expectedCurrent);
      seenEpisodes.add(await readEpisodeName(page));
      if (seenEpisodes.size > 1) break;
    }

    expect(
      seenEpisodes.size,
      `Expected EPISODE NAME to change as the user crosses a campaign boundary within @Zort70's images, ` +
      `but saw only: ${JSON.stringify([...seenEpisodes])}`
    ).toBeGreaterThan(1);

    // The total in the counter must stay pinned to the author's image
    // count throughout — it is not a per-campaign counter.
    const counter = await readCounter(page);
    expect(counter.total).toBe(total);
  });

  test('NEXT button in the toolbar advances and PREVIOUS reverses', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }
    if (total < 2) test.skip(true, 'Need at least 2 images');

    const grid = page.locator('[data-testid="author-images-grid"]');
    await grid.locator('.card img').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();

    const lightboxImg = page.locator('#lightbox-image');
    const initialSrc = await lightboxImg.getAttribute('src');
    expect(initialSrc).toBeTruthy();

    await page.locator('.lightbox-nav-toolbar').getByRole('button', { name: /next image/i }).click();
    await expect.poll(async () => await lightboxImg.getAttribute('src')).not.toBe(initialSrc);

    await page.locator('.lightbox-nav-toolbar').getByRole('button', { name: /previous image/i }).click();
    await expect.poll(async () => await lightboxImg.getAttribute('src')).toBe(initialSrc);
  });

  test('closing the lightbox returns to the author detail page (hash unchanged)', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    const grid = page.locator('[data-testid="author-images-grid"]');
    await grid.locator('.card img').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();

    // We should still be on the author-detail route — the lightbox must not
    // have rewritten the URL on close.
    expect(decodeURIComponent(new URL(page.url()).hash)).toBe(`#authors/${ZORT_HANDLE}`);
    await expect(grid).toBeVisible();
  });
});

test.describe('Author-browse mode — info-box in-app links', () => {
  test('clicking the AUTHOR handle inside the lightbox navigates to the author gallery', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    const grid = page.locator('[data-testid="author-images-grid"]');
    await grid.locator('.card img').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();

    // The AUTHOR row should be present and the handle should be a button
    // (NOT the external Twitter link — that is a separate icon-only <a>
    // beside the button, per fringematrix5-4a6o).
    const sidebar = page.locator('.lightbox-details').first();
    const authorRow = sidebar.locator('.lightbox-details-author');
    await expect(authorRow).toBeVisible();

    const handleButton = authorRow.getByRole('button', { name: /Zort70/ });
    await expect(handleButton).toBeVisible();

    await handleButton.click();

    // The lightbox closes and we land on the author detail page. We start
    // FROM the author detail page in this test, so the hash doesn't
    // actually change — but the route handler does fire, and the lightbox
    // must close. Verify both.
    await expect(page.locator('#lightbox')).toBeHidden();
    expect(decodeURIComponent(new URL(page.url()).hash)).toBe(`#authors/${ZORT_HANDLE}`);
    await expect(grid).toBeVisible();
  });

  test('clicking EPISODE NAME inside the lightbox switches the gallery to that campaign', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    const grid = page.locator('[data-testid="author-images-grid"]');
    await grid.locator('.card img').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();

    const sidebar = page.locator('.lightbox-details').first();
    const episodeRow = sidebar
      .locator('.lightbox-details-row')
      .filter({ hasText: 'EPISODE NAME' })
      .first();
    const episodeButton = episodeRow.locator('.lightbox-details-campaign-link');
    await expect(episodeButton).toBeVisible();

    // Capture the episode label so we can sanity-check the resulting
    // gallery (the toolbar shows the same campaign name).
    const episodeLabel = (await episodeButton.textContent())?.trim() ?? '';
    expect(episodeLabel.length).toBeGreaterThan(0);

    await episodeButton.click();

    // Lightbox closes …
    await expect(page.locator('#lightbox')).toBeHidden();

    // … the URL hash becomes #<campaignId>. We don't know the id
    // up-front (it's derived from the image's source campaign), but
    // the hash must NOT still be the author-detail hash, and it must
    // not be empty / #authors.
    const hash = new URL(page.url()).hash;
    expect(hash).not.toBe('');
    expect(hash).not.toBe('#authors');
    expect(hash.startsWith('#authors/')).toBe(false);
    expect(hash.startsWith('#')).toBe(true);

    // And we're on the campaign view, not the author detail view.
    // The campaign-info header is unique to the campaign route — assert
    // it's present rather than waiting for image cards, because the
    // destination campaign may legitimately be empty in this environment
    // (e.g. the source campaign listing returns no blobs even though the
    // image is attributed). What we care about here is the route switch,
    // not the image grid.
    //
    // Note: campaign.id is slugify(hashtag) (lowercased) while the displayed
    // hashtag preserves case, so we don't try to match the hash value
    // against the visible "Hashtag: #..." line — the route+header presence
    // and the earlier hash-shape assertions are sufficient.
    await expect(page.locator('[data-testid="author-images-grid"]')).toHaveCount(0);
    await expect(page.locator('#campaign-info')).toBeVisible();
  });
});
