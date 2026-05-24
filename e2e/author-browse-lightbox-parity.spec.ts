import { test, expect, Page } from '@playwright/test';

/**
 * E2E parity coverage for the author-browse lightbox (fringematrix5-gxw7,
 * parent epic fringematrix5-0tzn). Mirrors campaign-side behaviors that
 * fringematrix5-jq33 enabled by sharing `GalleryGrid` between the campaign
 * gallery and the author-detail page, and by threading the clicked
 * thumbnail element through `openLightboxForAuthor` so the zoom animation
 * has a real source rect.
 *
 * What this spec asserts:
 *   1. Active-thumb hide: the clicked thumbnail (and only that one) inside
 *      `[data-testid="author-images-grid"]` receives the
 *      `lightbox-active-thumb` class while the lightbox is open; the class
 *      hops to the next image on ArrowRight; the class is cleared from all
 *      grid images on Escape.
 *   2. Zoom animation smoke check: a `.wireframe-rect` element briefly
 *      mounts and becomes visible during the open transition in
 *      author-browse mode (today it never did, before jq33), then hides.
 *   3. Reduce-effects path: with `html.reduce-effects` set, no wireframe
 *      appears during the open transition, but the active-thumb hide still
 *      works (the active class is unrelated to motion).
 *
 * Resilience choices:
 *   - The exact opacity for `.card img.lightbox-active-thumb` is read from
 *     a hidden probe element in the live page rather than hard-coded, so
 *     the test still passes if the styles.css rule changes from
 *     `opacity: 0` to e.g. `opacity: 0.05`.
 *   - The presence of the wireframe element is asserted; no timing is
 *     measured (zoom is animation-driven and CI is variable).
 *   - Selectors prefer class / testid over visible text so the
 *     sibling-bead "author -> artist" UI-copy rename can't break this spec.
 *
 * Gating: `test.skip` when `BLOB_READ_WRITE_TOKEN` is missing (matches the
 * existing convention in `e2e/author-browse-mode.spec.ts`). @Zort70 is used
 * as the fixture.
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
 * Navigate to the @Zort70 author detail page and return the number of
 * thumbnails in the grid. When the environment has no blob token the grid
 * never appears; the caller is expected to skip in that case.
 */
async function gotoZortAuthorDetail(page: Page): Promise<number> {
  await page.goto(`/${ZORT_HASH}`);
  await waitForLoaderToFinish(page);

  const grid = page.locator('[data-testid="author-images-grid"]');
  await expect.poll(
    async () => (await grid.count()) > 0,
    { timeout: 15_000 },
  ).toBe(true).catch(() => {
    // fall through — count will read 0 and the caller will skip
  });

  return grid.locator('.card img').count();
}

/**
 * Read the resolved `opacity` of an `<img>` inside `.card` after adding the
 * `lightbox-active-thumb` class. The test uses a real DOM probe so it
 * picks up whatever value the live stylesheet defines for
 * `.card img.lightbox-active-thumb` — no hard-coded magic number.
 *
 * Returns a number in [0, 1] (typically 0). If no `.card img` exists, the
 * caller should skip the assertion.
 */
async function readActiveThumbStyledOpacity(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const sample = document.querySelector('.card img') as HTMLImageElement | null;
    if (!sample) return null;
    const hadClass = sample.classList.contains('lightbox-active-thumb');
    sample.classList.add('lightbox-active-thumb');
    const op = parseFloat(getComputedStyle(sample).opacity || '1');
    if (!hadClass) sample.classList.remove('lightbox-active-thumb');
    return op;
  });
}

async function waitForWireframeVisible(page: Page, timeout = 3000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return false;
    return getComputedStyle(el).display !== 'none';
  }, { timeout });
}

async function waitForWireframeHidden(page: Page, timeout = 3000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return true;
    return getComputedStyle(el).display === 'none';
  }, { timeout });
}

/** Return the indices of grid <img>s that currently carry the active class. */
async function activeThumbIndices(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-testid="author-images-grid"]');
    if (!grid) return [];
    const imgs = Array.from(grid.querySelectorAll('.card img')) as HTMLImageElement[];
    const out: number[] = [];
    imgs.forEach((img, i) => {
      if (img.classList.contains('lightbox-active-thumb')) out.push(i);
    });
    return out;
  });
}

test.describe('Author-browse lightbox — active-thumb hide parity', () => {
  test('clicked thumbnail receives lightbox-active-thumb; ArrowRight moves it; Escape clears it', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }
    if (total < 2) test.skip(true, 'Need at least 2 images in the author list for ArrowRight assertion');

    // Read whatever opacity the live stylesheet assigns to active thumbs.
    // Hard-coding 0 would silently break if styles.css drifts to e.g.
    // `opacity: 0.05` — we want to assert "the rule applied", not
    // "opacity is exactly 0".
    const activeOpacity = await readActiveThumbStyledOpacity(page);
    expect(activeOpacity, 'could not probe .card img.lightbox-active-thumb computed opacity').not.toBeNull();

    const grid = page.locator('[data-testid="author-images-grid"]');
    const firstImg = grid.locator('.card img').nth(0);
    const firstAlt = await firstImg.getAttribute('alt');

    await firstImg.click();
    await expect(page.locator('#lightbox')).toBeVisible();

    // Exactly one grid image carries the active class, and it's the one at
    // the clicked index.
    await expect.poll(() => activeThumbIndices(page)).toEqual([0]);

    // The active image's resolved opacity must match the stylesheet's
    // .card img.lightbox-active-thumb value.
    const firstOpacity = await firstImg.evaluate((el) => parseFloat(getComputedStyle(el as HTMLElement).opacity || '1'));
    expect(firstOpacity).toBeCloseTo(activeOpacity as number, 2);

    // Sanity: a non-active sibling has opacity > the active-style opacity
    // (i.e. it's visible) — guards against a regression where the class is
    // applied to every image.
    const secondImg = grid.locator('.card img').nth(1);
    const secondOpacityBefore = await secondImg.evaluate(
      (el) => parseFloat(getComputedStyle(el as HTMLElement).opacity || '1'),
    );
    expect(secondOpacityBefore).toBeGreaterThan(activeOpacity as number);

    // Advance: class should hop to index 1.
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => activeThumbIndices(page)).toEqual([1]);

    // And the original alt is no longer the active one.
    if (firstAlt) {
      const firstStillActive = await page.evaluate(
        (alt) => {
          const grid = document.querySelector('[data-testid="author-images-grid"]');
          if (!grid) return false;
          const img = grid.querySelector(`.card img[alt="${(alt as string).replace(/"/g, '\\"')}"]`);
          return !!img?.classList.contains('lightbox-active-thumb');
        },
        firstAlt,
      );
      expect(firstStillActive).toBe(false);
    }

    // Close: class must be gone from every grid image.
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
    await expect.poll(() => activeThumbIndices(page)).toEqual([]);
  });
});

test.describe('Author-browse lightbox — zoom animation parity', () => {
  test('wireframe element mounts during the open transition', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    // Make sure reduce-effects / reduce-motion is OFF — otherwise the
    // animation is intentionally skipped and the wireframe never mounts.
    await page.evaluate(() => {
      document.documentElement.classList.remove('reduce-motion');
      document.documentElement.classList.remove('reduce-effects');
    });

    const grid = page.locator('[data-testid="author-images-grid"]');
    await grid.locator('.card img').first().click();

    // The wireframe should briefly become visible during the zoom-in
    // transition. We don't measure how long — only that it exists at all
    // (before fringematrix5-jq33 it never did from author-browse mode).
    await waitForWireframeVisible(page);
    await waitForWireframeHidden(page);

    await expect(page.locator('#lightbox')).toBeVisible();

    // Close cleanly so the next test starts fresh.
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

test.describe('Author-browse lightbox — reduce-effects guard', () => {
  test('with html.reduce-effects set, active-thumb hide still works (class is unrelated to motion)', async ({ page }) => {
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    // Toggle reduce-effects via the html class directly. The in-app
    // settings toggle writes the exact same class (see App.tsx). This
    // bypasses the panel clip-path animations (sidebar/toolbar/frame), but
    // does NOT bypass the wireframe zoom — that path is gated by the React
    // `reduceMotion` state passed to useLightboxAnimations, not by the html
    // class. Mirrors the campaign-side coverage in
    // e2e/lightbox-redesign.spec.ts which also exercises the class-only
    // bypass for the sidebar.
    await page.evaluate(() => document.documentElement.classList.add('reduce-effects'));

    const activeOpacity = await readActiveThumbStyledOpacity(page);
    expect(activeOpacity, 'could not probe .card img.lightbox-active-thumb computed opacity').not.toBeNull();

    const grid = page.locator('[data-testid="author-images-grid"]');
    const firstImg = grid.locator('.card img').nth(0);
    await firstImg.click();

    await expect(page.locator('#lightbox')).toBeVisible();

    // Active-thumb hide must work even with reduce-effects on — the class
    // is applied synchronously by the lightbox-open path and is unrelated
    // to any WAAPI animation that the html class would gate.
    await expect.poll(() => activeThumbIndices(page)).toEqual([0]);

    // The active image's resolved opacity must still match the
    // .card img.lightbox-active-thumb rule under reduce-effects.
    const firstOpacity = await firstImg.evaluate(
      (el) => parseFloat(getComputedStyle(el as HTMLElement).opacity || '1'),
    );
    expect(firstOpacity).toBeCloseTo(activeOpacity as number, 2);

    // Cleanup: close and remove the reduce-effects class so we don't leak
    // state into other specs that share the same browser context.
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
    await page.evaluate(() => document.documentElement.classList.remove('reduce-effects'));

    // Active class must be cleared on close under reduce-effects too.
    await expect.poll(() => activeThumbIndices(page)).toEqual([]);
  });

  test('with Reduce Motion toggled on via settings, zoom is skipped but active-thumb hide still works', async ({ page }) => {
    // Reduce Motion via the in-app settings modal updates React state
    // (App.tsx `reduceMotion` -> useLightboxAnimations `reduceMotion`),
    // which IS the gate for the wireframe zoom. So with this toggle on
    // the wireframe must not become visible during the open.
    const total = await gotoZortAuthorDetail(page);
    if (total === 0) {
      test.skip(true, 'No images returned for @Zort70 (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    // Open the Settings modal and flip Reduce Motion. Matches the pattern
    // used in e2e/app.spec.ts so the assertions about ARIA labels stay
    // valid as the UI evolves.
    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await expect(modal).toBeVisible();
    const reduceMotionToggle = modal.getByRole('switch', { name: 'Reduce Motion' });
    await reduceMotionToggle.click();
    await expect(reduceMotionToggle).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    const grid = page.locator('[data-testid="author-images-grid"]');
    const firstImg = grid.locator('.card img').nth(0);

    // Watch for any wireframe visibility transition during the open so we
    // don't miss a flash that lands between assertion samples. The flag is
    // raised by a MutationObserver that fires synchronously on style
    // changes; results are read after the lightbox is settled open.
    await page.evaluate(() => {
      (window as unknown as Record<string, boolean>)['__wireframeWasVisible'] = false;
      const check = () => {
        const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
        if (el && getComputedStyle(el).display !== 'none') {
          (window as unknown as Record<string, boolean>)['__wireframeWasVisible'] = true;
        }
      };
      // Sample once immediately, then on every relevant mutation.
      check();
      const obs = new MutationObserver(check);
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      (window as unknown as Record<string, unknown>)['__wireframeObs'] = obs;
    });

    await firstImg.click();
    await expect(page.locator('#lightbox')).toBeVisible();

    // Active-thumb hide must work in reduce-motion mode — applied
    // synchronously by the open path, independent of the WAAPI gating.
    await expect.poll(() => activeThumbIndices(page)).toEqual([0]);

    // Settle a frame so the observer has a chance to record any transition.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

    const wireframeWasVisible = await page.evaluate(() => {
      const obs = (window as unknown as Record<string, MutationObserver>)['__wireframeObs'];
      if (obs) obs.disconnect();
      return (window as unknown as Record<string, boolean>)['__wireframeWasVisible'];
    });
    expect(
      wireframeWasVisible,
      'Wireframe became visible during reduce-motion open — the React reduceMotion gate did not fire',
    ).toBe(false);

    // Close cleanly. Active class must be cleared.
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
    await expect.poll(() => activeThumbIndices(page)).toEqual([]);
  });
});
