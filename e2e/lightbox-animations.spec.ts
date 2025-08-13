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

async function waitForWireframeVisible(page: Page, timeout = 1500) {
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

// Using shared util imported above

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

    // Ensure wireframe is not displayed outside of animation while lightbox sits open
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


