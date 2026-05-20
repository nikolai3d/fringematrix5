import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the thumbnail polish epic, covering three work items:
 *
 * - fringematrix5-qbp: File name labels removed from thumbnail cards.
 * - fringematrix5-ruy: Gallery gap driven by --grid-gap CSS variable per scale step.
 * - fringematrix5-7us: Zoom in / Zoom out buttons flank the ThumbnailSizeSlider.
 *
 * All tests target the main toolbar's ThumbnailSizeSlider widget
 * (aria-label "Zoom in" / "Zoom out") and the gallery grid (#gallery /
 * .gallery-grid).
 */

// Reliably drive a React-controlled <input type="range"> from Playwright.
async function setSliderValue(page: Page, sliderLabel: string, value: string) {
  const slider = page.getByLabel(sliderLabel);
  await slider.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    if (setter) {
      setter.call(input, v);
    } else {
      input.value = v;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function waitForLoader(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }
}

/**
 * Navigate to the app, clearing a11y state so scale starts at the
 * configured default.
 */
async function gotoClean(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('fringematrix-a11y');
  });
  await page.goto('/');
  await waitForLoader(page);
}

/**
 * Walk the campaign sidebar until we land on a campaign that has at least
 * one rendered `.gallery-grid .card`. Returns true if cards are available.
 */
async function findCampaignWithCards(page: Page): Promise<boolean> {
  const firstCard = page.locator('.gallery-grid .card').first();
  if (await firstCard.isVisible().catch(() => false)) return true;

  await page.getByRole('button', { name: 'Campaigns' }).click();
  const sidebar = page.locator('#campaign-sidebar');
  await expect(sidebar).toHaveClass(/open/);
  const sidebarButtons = sidebar.getByRole('button');
  const buttonCount = await sidebarButtons.count();

  for (let i = 0; i < buttonCount; i++) {
    if (!(await sidebar.evaluate((el) => el.classList.contains('open')))) {
      await page.getByRole('button', { name: 'Campaigns' }).click();
      await expect(sidebar).toHaveClass(/open/);
    }
    await sidebarButtons.nth(i).click();

    const progressArea = page.getByRole('status', { name: 'Campaign loading status' });
    const loadingContent = progressArea.locator('.campaign-loading-content');
    if (await loadingContent.isVisible().catch(() => false)) {
      await loadingContent.waitFor({ state: 'detached' });
    }

    if (await firstCard.isVisible().catch(() => false)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Thumbnail polish epic', () => {
  test.beforeEach(async ({ page }) => {
    await gotoClean(page);
  });

  // -------------------------------------------------------------------------
  // Test 1: No visible file names on thumbnail cards
  // -------------------------------------------------------------------------

  test('no visible filename text inside thumbnail cards', async ({ page }) => {
    const hasCards = await findCampaignWithCards(page);
    if (!hasCards) {
      test.skip(true, 'No gallery cards available; skipping filename check');
    }

    const grid = page.locator('.gallery-grid');
    await expect(grid).toBeVisible();

    // Confirm the .filename element has been removed: no descendant of any
    // .card should carry the class.
    const filenameEls = grid.locator('.card .filename');
    await expect(filenameEls).toHaveCount(0);

    // Broader check: no text node inside any .card should match a bare image
    // file-name pattern (e.g. "avatar-007.jpg").  We assert that no card
    // contains text that looks like a raw filename.
    const cards = grid.locator('.card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const textContent = (await card.textContent()) ?? '';
      // A raw filename would match e.g. "some-name.jpg" or "IMG_0001.PNG".
      // Cards should have no text at all (only image content).
      expect(textContent).not.toMatch(/\.(jpe?g|png|gif|webp|avif)$/i);
    }
  });

  test('img alt attribute is still present on thumbnail images', async ({ page }) => {
    const hasCards = await findCampaignWithCards(page);
    if (!hasCards) {
      test.skip(true, 'No gallery cards available; skipping alt attribute check');
    }

    const grid = page.locator('.gallery-grid');
    // Pick the first real (non-placeholder) image in the grid.
    const firstImg = grid.locator('.card img').first();
    await expect(firstImg).toBeVisible();

    const alt = await firstImg.getAttribute('alt');
    // alt must be present and non-empty — even though it's hidden visually,
    // it is required for screen-reader accessibility.
    expect(alt).toBeTruthy();
    expect(typeof alt).toBe('string');
    expect((alt as string).length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 2: Grid gap shrinks as scale decreases
  // -------------------------------------------------------------------------

  test('grid gap (--grid-gap) is strictly smaller at the smallest scale step than the largest', async ({ page }) => {
    // Read the slider's max to know the number of steps.
    const slider = page.getByLabel('THUMBNAIL SIZE');
    await expect(slider).toBeVisible();
    const maxStr = await slider.evaluate((el) => (el as HTMLInputElement).max);
    const max = Number(maxStr);
    expect(max).toBeGreaterThan(0); // needs at least 2 steps

    // Move to the largest scale and read the gap.
    await setSliderValue(page, 'THUMBNAIL SIZE', maxStr);
    await expect(slider).toHaveValue(maxStr);

    const largeGap = await page.evaluate(() => {
      const raw = document.documentElement.style.getPropertyValue('--grid-gap');
      return parseFloat(raw);
    });

    // Move to the smallest scale and re-read.
    await setSliderValue(page, 'THUMBNAIL SIZE', '0');
    await expect(slider).toHaveValue('0');

    const smallGap = await page.evaluate(() => {
      const raw = document.documentElement.style.getPropertyValue('--grid-gap');
      return parseFloat(raw);
    });

    // The gap at the smallest step must be strictly smaller than at the
    // largest step.
    expect(smallGap).toBeLessThan(largeGap);
  });

  test('no horizontal overflow at the smallest scale step', async ({ page }) => {
    const slider = page.getByLabel('THUMBNAIL SIZE');
    await expect(slider).toBeVisible();

    // Move to the smallest step.
    await setSliderValue(page, 'THUMBNAIL SIZE', '0');
    await expect(slider).toHaveValue('0');

    // The document body must not overflow horizontally.
    const overflow = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth > body.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Test 3: Zoom buttons change thumbnail size and disable at bounds
  // -------------------------------------------------------------------------

  test('Zoom in button increases thumbnail width', async ({ page }) => {
    const hasCards = await findCampaignWithCards(page);
    if (!hasCards) {
      test.skip(true, 'No gallery cards available; skipping zoom-in width check');
    }

    const toolbar = page.getByRole('toolbar', { name: 'Primary actions' });
    const slider = toolbar.getByLabel('THUMBNAIL SIZE');

    // Start at the smallest step so there is room to zoom in.
    await setSliderValue(page, 'THUMBNAIL SIZE', '0');
    await expect(slider).toHaveValue('0');

    const firstCard = page.locator('.gallery-grid .card').first();
    const baseBox = await firstCard.boundingBox();
    expect(baseBox).not.toBeNull();
    const baseW = baseBox!.width;

    const zoomIn = toolbar.getByRole('button', { name: 'Zoom in' });
    await expect(zoomIn).toBeEnabled();
    await zoomIn.click();

    // Width must increase after clicking Zoom in.
    await expect.poll(async () => {
      const b = await firstCard.boundingBox();
      return b ? b.width : 0;
    }, { timeout: 5000 }).toBeGreaterThan(baseW);
  });

  test('Zoom out button decreases thumbnail width', async ({ page }) => {
    const hasCards = await findCampaignWithCards(page);
    if (!hasCards) {
      test.skip(true, 'No gallery cards available; skipping zoom-out width check');
    }

    const toolbar = page.getByRole('toolbar', { name: 'Primary actions' });
    const slider = toolbar.getByLabel('THUMBNAIL SIZE');

    // Start at the largest step so there is room to zoom out.
    const maxStr = await slider.evaluate((el) => (el as HTMLInputElement).max);
    await setSliderValue(page, 'THUMBNAIL SIZE', maxStr);
    await expect(slider).toHaveValue(maxStr);

    const firstCard = page.locator('.gallery-grid .card').first();
    const baseBox = await firstCard.boundingBox();
    expect(baseBox).not.toBeNull();
    const baseW = baseBox!.width;

    const zoomOut = toolbar.getByRole('button', { name: 'Zoom out' });
    await expect(zoomOut).toBeEnabled();
    await zoomOut.click();

    // Width must decrease after clicking Zoom out.
    await expect.poll(async () => {
      const b = await firstCard.boundingBox();
      return b ? b.width : Number.POSITIVE_INFINITY;
    }, { timeout: 5000 }).toBeLessThan(baseW);
  });

  test('Zoom out button is disabled at the minimum scale step', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: 'Primary actions' });
    const slider = toolbar.getByLabel('THUMBNAIL SIZE');

    // Drive slider to the minimum step via the slider (reliable).
    await setSliderValue(page, 'THUMBNAIL SIZE', '0');
    await expect(slider).toHaveValue('0');

    const zoomOut = toolbar.getByRole('button', { name: 'Zoom out' });
    await expect(zoomOut).toBeDisabled();

    // Zoom in must still be enabled at the minimum.
    const zoomIn = toolbar.getByRole('button', { name: 'Zoom in' });
    await expect(zoomIn).toBeEnabled();
  });

  test('Zoom in button is disabled at the maximum scale step', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: 'Primary actions' });
    const slider = toolbar.getByLabel('THUMBNAIL SIZE');

    const maxStr = await slider.evaluate((el) => (el as HTMLInputElement).max);
    await setSliderValue(page, 'THUMBNAIL SIZE', maxStr);
    await expect(slider).toHaveValue(maxStr);

    const zoomIn = toolbar.getByRole('button', { name: 'Zoom in' });
    await expect(zoomIn).toBeDisabled();

    // Zoom out must still be enabled at the maximum.
    const zoomOut = toolbar.getByRole('button', { name: 'Zoom out' });
    await expect(zoomOut).toBeEnabled();
  });
});
