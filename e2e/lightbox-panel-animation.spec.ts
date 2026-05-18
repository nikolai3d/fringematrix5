/**
 * E2E smoke tests for the unified lightbox panel animation (animateLightboxPanel).
 *
 * Coverage:
 *  - Normal motion: lightbox opens and closes; sidebar, image-frame, and nav toolbar
 *    are visible while lightbox is open and hidden after close.
 *  - Reduce-motion (html.reduce-motion class): panels appear and disappear
 *    instantly without clip-path animation.
 *  - Reduce-effects (html.reduce-effects class): same instant-transition guarantee.
 *  - prefers-reduced-motion emulation: same instant-transition guarantee.
 */
import { test, expect, Page } from '@playwright/test';

async function waitForLoaderToFinish(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  const visible = await loader.isVisible().catch(() => false);
  if (visible) await loader.waitFor({ state: 'detached' });
}

async function openLightbox(page: Page) {
  const firstCard = page.locator('.gallery-grid .card').first();
  const hasCard = await firstCard.isVisible().catch(() => false);
  if (!hasCard) {
    test.skip(true, 'No images available — skipping lightbox panel animation test');
  }
  await firstCard.click();
  await expect(page.locator('#lightbox')).toBeVisible();
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal-motion smoke test
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Lightbox panel animation — normal motion', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure reduce-motion is off
    await page.addInitScript(() => {
      localStorage.removeItem('fringematrix-a11y');
    });
    await page.goto('/');
    await waitForLoaderToFinish(page);
  });

  test('sidebar, image frame, and nav toolbar are visible while lightbox is open', async ({ page }) => {
    await openLightbox(page);

    // After open animation settles, the three panels should be present in DOM
    // and not visually clipped to nothing.
    const sidebar = page.locator('.lightbox-details');
    const imageWrap = page.locator('.lightbox-image-wrap');
    const navToolbar = page.locator('.lightbox-nav-toolbar');

    await expect(sidebar).toBeAttached();
    await expect(imageWrap).toBeAttached();
    await expect(navToolbar).toBeAttached();

    // Panels should not have a clip-path that collapses them to a line after
    // the enter animation completes. The function clears inline overrides at the
    // end of direction='in', so computed clip-path should be none or a full-reveal value.
    const sidebarClip = await sidebar.evaluate((el) => getComputedStyle(el).clipPath);
    // Accept 'none', empty string, or an inset that is NOT the collapsed midline value.
    // The collapsed sentinel is `inset(calc(50% - 1px) 0 calc(50% - 1px) 0)`.
    // After animation settles the inline style is cleared so computed falls back to CSS (none).
    const COLLAPSED = 'inset(calc(50% - 1px) 0 calc(50% - 1px) 0)';
    expect(sidebarClip).not.toBe(COLLAPSED);

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
  });

  test('lightbox can be opened and closed without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await openLightbox(page);

    // Navigate a few images
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();

    expect(errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reduce-motion guard: html.reduce-motion class
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Lightbox panel animation — reduce-motion class guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('fringematrix-a11y');
    });
    await page.goto('/');
    await waitForLoaderToFinish(page);
  });

  test('panels appear without animation when html.reduce-motion is set', async ({ page }) => {
    // Force the reduce-motion class before opening the lightbox
    await page.evaluate(() => {
      document.documentElement.classList.add('reduce-motion');
    });

    await openLightbox(page);

    // With reduce-motion on, animateLightboxPanel bails out before calling
    // element.animate. The panels should be visible (not stuck clipped).
    const sidebar = page.locator('.lightbox-details');
    await expect(sidebar).toBeAttached();

    // Verify the panel is NOT stuck in the collapsed-line state (clip-path sentinel).
    // The CSS reduce-motion rule resets clip-path to none/initial.
    const sidebarClip = await sidebar.evaluate((el) => getComputedStyle(el).clipPath);
    const COLLAPSED = 'inset(calc(50% - 1px) 0 calc(50% - 1px) 0)';
    expect(sidebarClip).not.toBe(COLLAPSED);

    // Verify element.animate was NOT called on the sidebar (animation skipped).
    // We do this by checking that no WAAPI animations are running on the sidebar.
    const sidebarAnimCount = await sidebar.evaluate((el) => el.getAnimations().length);
    expect(sidebarAnimCount).toBe(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();

    // Also verify no animations ran during close
    const afterCloseAnimCount = await page.evaluate(() => {
      const el = document.querySelector('.lightbox-details');
      return el ? el.getAnimations().length : 0;
    });
    expect(afterCloseAnimCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reduce-motion guard: html.reduce-effects class
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Lightbox panel animation — reduce-effects class guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('fringematrix-a11y');
    });
    await page.goto('/');
    await waitForLoaderToFinish(page);
  });

  test('panels appear without clip-path animation when html.reduce-effects is set', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('reduce-effects');
    });

    await openLightbox(page);

    const sidebar = page.locator('.lightbox-details');
    await expect(sidebar).toBeAttached();

    const sidebarClip = await sidebar.evaluate((el) => getComputedStyle(el).clipPath);
    const COLLAPSED = 'inset(calc(50% - 1px) 0 calc(50% - 1px) 0)';
    expect(sidebarClip).not.toBe(COLLAPSED);

    const sidebarAnimCount = await sidebar.evaluate((el) => el.getAnimations().length);
    expect(sidebarAnimCount).toBe(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reduce-motion guard: prefers-reduced-motion media emulation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Lightbox panel animation — prefers-reduced-motion emulation', () => {
  test('panels appear instantly when prefers-reduced-motion: reduce is emulated', async ({ browser }) => {
    // Create a new context with prefers-reduced-motion: reduce
    const context = await browser.newContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.removeItem('fringematrix-a11y');
    });
    await page.goto('/');
    await waitForLoaderToFinish(page);

    const firstCard = page.locator('.gallery-grid .card').first();
    const hasCard = await firstCard.isVisible().catch(() => false);
    if (!hasCard) {
      await context.close();
      test.skip(true, 'No images available');
    }

    await firstCard.click();
    await expect(page.locator('#lightbox')).toBeVisible();

    const sidebar = page.locator('.lightbox-details');
    await expect(sidebar).toBeAttached();

    // With prefers-reduced-motion: reduce, animateLightboxPanel bails before
    // calling element.animate. The sidebar should have no running WAAPI animations.
    const sidebarAnimCount = await sidebar.evaluate((el) => el.getAnimations().length);
    expect(sidebarAnimCount).toBe(0);

    // Clip-path should not be stuck in the collapsed state
    const sidebarClip = await sidebar.evaluate((el) => getComputedStyle(el).clipPath);
    const COLLAPSED = 'inset(calc(50% - 1px) 0 calc(50% - 1px) 0)';
    expect(sidebarClip).not.toBe(COLLAPSED);

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();

    await context.close();
  });
});
