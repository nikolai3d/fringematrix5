import { test, expect, Page } from '@playwright/test';

let escapeForAttributeSelectorFn: (value: string) => string;
test.beforeAll(async () => {
  const mod = await import('../client/src/utils/escapeForAttributeSelector.js');
  escapeForAttributeSelectorFn = mod.escapeForAttributeSelector as (value: string) => string;
});

async function waitForLoaderToFinish(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  const visible = await loader.isVisible().catch(() => false);
  if (visible) await loader.waitFor({ state: 'detached' });
}

async function getWireframeState(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return { present: false, display: 'none', opacity: 0 };
    const cs = getComputedStyle(el);
    return { present: true, display: cs.display, opacity: parseFloat(cs.opacity || '0') };
  });
}

async function waitForWireframeVisible(page: Page, timeout = 3000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none';
  }, { timeout });
}

async function waitForWireframeHidden(page: Page, timeout = 3000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return true;
    return getComputedStyle(el).display === 'none';
  }, { timeout });
}


async function getGridImageOpacityBySrc(page: Page, src: string) {
  const selector = `.gallery-grid .card img[src="${escapeForAttributeSelectorFn(src)}"]`;
  return page.evaluate((sel) => {
    const img = document.querySelector(sel) as HTMLElement | null;
    if (!img) return null;
    const cs = getComputedStyle(img);
    return parseFloat(cs.opacity || '1');
  }, selector);
}

async function getLightboxBackdropAlpha(page: Page) {
  return page.evaluate(() => {
    const el = document.getElementById('lightbox');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(p => parseFloat(p.trim()));
    return parts.length === 4 ? parts[3] : (parts.length === 3 ? 1 : null);
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForLoaderToFinish(page);
});

test.describe('Lightbox animation after tab visibility change', () => {
  test('lightbox opens correctly when getBoundingClientRect initially returns zero-dimension rects', async ({ page }) => {
    // This test simulates the bug where, after switching away from the tab
    // and back, getBoundingClientRect returns {0,0,0,0} because the browser
    // has evicted decoded image data.  The fix retries layout measurement
    // for a few frames before falling back to showing the image directly.
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);

    // Intercept getBoundingClientRect so the lightbox image reports zeros
    // for the first two calls, simulating a stale-layout scenario.
    await page.evaluate(() => {
      const orig = Element.prototype.getBoundingClientRect;
      let interceptCount = 0;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.id === 'lightbox-image' && interceptCount < 2) {
          interceptCount++;
          return new DOMRect(0, 0, 0, 0);
        }
        return orig.call(this);
      };
      // Auto-restore after 5 s so other tests aren't affected
      setTimeout(() => { Element.prototype.getBoundingClientRect = orig; }, 5000);
    });

    // Click first image to open lightbox
    await firstImg.click();

    // Lightbox must become visible even though initial rects were zero
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // The lightbox image must be visible (not stuck at opacity: 0)
    const lightboxImage = page.locator('#lightbox-image');
    await expect(lightboxImage).toBeVisible();

    // Wireframe should be hidden once the animation (or fallback) completes
    await waitForWireframeHidden(page);

    // Close the lightbox
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
  });

  test('lightbox falls back gracefully when all rect retries return zero', async ({ page }) => {
    // When every retry returns zeros (e.g. persistent layout failure), the
    // fix should skip the wireframe animation entirely and show the lightbox
    // image directly without getting stuck.
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);

    // Make EVERY getBoundingClientRect call for #lightbox-image return zeros
    // so the retry loop exhausts all attempts and hits the fallback path.
    await page.evaluate(() => {
      const orig = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.id === 'lightbox-image') return new DOMRect(0, 0, 0, 0);
        return orig.call(this);
      };
      // Auto-restore after 5 s so other tests aren't affected
      setTimeout(() => { Element.prototype.getBoundingClientRect = orig; }, 5000);
    });

    await firstImg.click();

    // Lightbox must still become visible (fallback shows image directly)
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // The lightbox image must not be stuck invisible
    const lightboxImage = page.locator('#lightbox-image');
    await expect(lightboxImage).toBeVisible();

    // Wireframe should be hidden (animation was skipped)
    await waitForWireframeHidden(page);

    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
  });
});

test.describe('Image frame blink regression', () => {
  test('image frame is collapsed before wireframe zoom completes (no pre-delay blink)', async ({ page }) => {
    // Regression test for fringematrix5-f4p: the .lightbox-image-wrap frame
    // was visible at full size for ~126 ms at the start of the zoom-in
    // animation before animateLightboxPanel collapsed it — producing a blink.
    // The fix applies COLLAPSED_CLIP immediately, before the delay fires.
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    // Intercept the frame's clip-path right when the wireframe first appears
    // (the pre-delay window where the blink occurred). Use page.evaluate to
    // install the observer on the current document — addInitScript only runs
    // on fresh navigations so it would miss the already-loaded page.
    let clipPathAtWireframeVisible: string | null = null;
    await page.exposeFunction('recordFrameClipPath', (clipPath: string) => {
      clipPathAtWireframeVisible = clipPath;
    });
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        const wf = document.querySelector('.wireframe-rect') as HTMLElement | null;
        if (!wf) return;
        if (getComputedStyle(wf).display !== 'none') {
          const frame = document.querySelector('.lightbox-image-wrap') as HTMLElement | null;
          if (frame) {
            const clip = frame.style.clipPath || getComputedStyle(frame).clipPath;
            (window as unknown as Record<string, (c: string) => void>)['recordFrameClipPath'](clip);
          }
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    });

    await cards.nth(0).click();
    await waitForWireframeVisible(page);
    await waitForWireframeHidden(page);

    // Assert the observer fired — if null, the measurement path is broken and
    // the test would pass vacuously without actually checking the fix.
    expect(clipPathAtWireframeVisible, 'MutationObserver did not record clip-path at wireframe-visible time').not.toBeNull();

    // The frame must NOT have been at its natural (uncollapsed) state when
    // the wireframe first appeared. Either the inline clipPath was the
    // COLLAPSED value, or (if observer fired after expansion) the expanded
    // value. What is NOT acceptable is no clip-path at that moment.
    const isCollapsed = (clipPathAtWireframeVisible as string).includes('calc(50%');
    const isExpanded = clipPathAtWireframeVisible === 'inset(0 0 0 0)' || clipPathAtWireframeVisible === 'inset(0px 0px 0px 0px)';
    expect(
      isCollapsed || isExpanded,
      `Frame clip-path was "${clipPathAtWireframeVisible}" at wireframe-visible time — frame was at its natural state (blink regression)`,
    ).toBe(true);

    // After animation: lightbox is open and frame is fully expanded
    await expect(page.locator('#lightbox')).toBeVisible();
    await expect(page.locator('.lightbox-image-wrap')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

test.describe('Lightbox animations', () => {
  test('zoom-in shows wireframe and dims backdrop; thumbnails fade and navigation updates fades', async ({ page, browserName }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);
    const secondImg = count > 1 ? cards.nth(1) : null;
    const firstSrc = await firstImg.getAttribute('src');
    const secondSrc = secondImg ? await secondImg.getAttribute('src') : null;

    // Open lightbox by clicking first image
    await firstImg.click();

    // Wireframe should appear during zoom-in, then hide
    await waitForWireframeVisible(page);
    await waitForWireframeHidden(page);

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Backdrop should become non-transparent while lightbox is open
    const alpha = await getLightboxBackdropAlpha(page);
    expect(alpha).not.toBeNull();
    expect(alpha as number).toBeGreaterThan(0);

    // Original thumbnail should fade when its image is displayed in lightbox
    if (firstSrc) {
      const op = await getGridImageOpacityBySrc(page, firstSrc);
      expect(op).not.toBeNull();
      expect(op as number).toBeLessThan(1);
    }

    // Navigate right if we have a second image and verify fades swap
    if (secondSrc) {
      await page.keyboard.press('ArrowRight');
      // New current (second) should fade
      await expect.poll(async () => await getGridImageOpacityBySrc(page, secondSrc)).toBeLessThan(1);
      // Previous (first) should restore
      await expect.poll(async () => await getGridImageOpacityBySrc(page, firstSrc!)).toBeGreaterThanOrEqual(0.99);

      // Navigate back left and verify fades swap back
      await page.keyboard.press('ArrowLeft');
      await expect.poll(async () => await getGridImageOpacityBySrc(page, firstSrc!)).toBeLessThan(1);
      await expect.poll(async () => await getGridImageOpacityBySrc(page, secondSrc!)).toBeGreaterThanOrEqual(0.99);
    }

    // Ensure wireframe is not displayed outside of animation while lightbox sits open.
    // Use waitForWireframeHidden to handle any residual animation timing in CI before
    // asserting the settled state; then snapshot to confirm the element exists.
    await waitForWireframeHidden(page);
    const wfMid = await getWireframeState(page);
    expect(wfMid.present).toBeTruthy();
    expect(wfMid.display).toBe('none');

    // Close via Escape -> should play wireframe and hide
    await page.keyboard.press('Escape');
    await waitForWireframeVisible(page);
    await waitForWireframeHidden(page);
    await expect(lightbox).toBeHidden();
  });

  test('backdrop opacity animates and changes on open/close; wireframe not visible outside animations', async ({ page }) => {
    const img = page.locator('.gallery-grid .card img').first();
    const hasImg = await img.isVisible().catch(() => false);
    if (!hasImg) test.skip(true, 'No images available to test lightbox');

    await img.click();
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Verify non-zero alpha during open state
    await expect.poll(async () => await getLightboxBackdropAlpha(page)).toBeGreaterThan(0);

    // Wireframe should be hidden after open completes
    await waitForWireframeHidden(page);

    // Close and ensure lightbox fully closes and wireframe is hidden afterward
    await page.keyboard.press('Escape');
    await waitForWireframeVisible(page);
    await waitForWireframeHidden(page);
    await expect(lightbox).toBeHidden();
  });

  test('animations resilient to resize and clicks during play (no interruption)', async ({ page }) => {
    const img = page.locator('.gallery-grid .card img').first();
    const hasImg = await img.isVisible().catch(() => false);
    if (!hasImg) test.skip(true, 'No images available to test lightbox');

    // Start opening
    await img.click();

    // During animation, trigger viewport resize and random clicks; it should still finish cleanly
    await waitForWireframeVisible(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await page.mouse.click(10, 10);

    // Animation should conclude with lightbox open and wireframe hidden
    await waitForWireframeHidden(page);
    await expect(page.locator('#lightbox')).toBeVisible();

    // Start closing and resize again
    await page.keyboard.press('Escape');
    await waitForWireframeVisible(page);
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.mouse.click(15, 15);
    await waitForWireframeHidden(page);
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

