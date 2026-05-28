import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * E2E tests for the ThumbnailSizeSlider placed inside the Settings modal.
 *
 * The slider is a controlled native `<input type="range">` whose value
 * (0..steps-1) drives the `--thumbnail-min-size` CSS variable on
 * `<html>`. The CSS variable in turn feeds `.gallery-grid`'s
 * `grid-template-columns: repeat(auto-fill, minmax(var(--thumbnail-min-size), 1fr))`,
 * so changing the slider measurably resizes each `.gallery-grid .card`.
 *
 * The selected index is persisted in `localStorage` under the
 * `fringematrix-a11y` key (shared with Reduce Effects / Reduce Motion).
 */

// Reliably drive a React-controlled <input type="range"> from Playwright.
// `el.value = ...` alone does not fire React's onChange, so we call the
// native value setter and then dispatch a bubbling `input` event.
async function setSliderValue(slider: Locator, value: string) {
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

async function gotoClean(page: Page) {
  // Ensure the slider starts at the configured default by clearing the
  // accessibility-state key before the app's first localStorage read.
  await page.addInitScript(() => {
    localStorage.removeItem('fringematrix-a11y');
  });
  await page.goto('/');
  await waitForLoader(page);
}

async function openSettings(page: Page) {
  const settingsBtn = page.getByRole('button', { name: 'Settings' });
  await settingsBtn.click();
  const modal = page.getByRole('dialog', { name: 'Settings' });
  await expect(modal).toBeVisible();
  return modal;
}

async function closeSettings(page: Page) {
  await page.getByRole('button', { name: /close settings/i }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).not.toBeVisible();
}

/**
 * Walk the campaign sidebar until we land on a campaign that has at least
 * one rendered `.gallery-grid .card`. Returns true if cards are available.
 * Falls back to false if no campaign in the sidebar has cards (e.g. the
 * Vercel Blob token is missing locally and every campaign is empty).
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

    // Wait for any campaign loading to settle before checking cards.
    const progressArea = page.getByRole('status', { name: 'Campaign loading status' });
    const loadingContent = progressArea.locator('.campaign-loading-content');
    if (await loadingContent.isVisible().catch(() => false)) {
      await loadingContent.waitFor({ state: 'detached' });
    }

    if (await firstCard.isVisible().catch(() => false)) return true;
  }
  return false;
}

test.describe('Thumbnail size slider (Settings modal)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoClean(page);
  });

  test('slider is NOT visible in the toolbar', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: 'Primary actions' });
    await expect(toolbar).toBeVisible();
    const sliderInToolbar = toolbar.getByLabel('THUMBNAIL SIZE');
    await expect(sliderInToolbar).not.toBeVisible();
  });

  test('slider is visible inside the open Settings modal with the expected label', async ({ page }) => {
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('type', 'range');
  });

  test('moving slider to the largest step measurably increases card width', async ({ page }) => {
    const hasCards = await findCampaignWithCards(page);
    if (!hasCards) {
      test.skip(true, 'No gallery cards available to measure');
    }

    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    // First set to minimum so we have a reliable baseline.
    await setSliderValue(slider, '0');
    await expect(slider).toHaveValue('0');
    await closeSettings(page);

    const firstCard = page.locator('.gallery-grid .card').first();
    const baseBox = await firstCard.boundingBox();
    expect(baseBox).not.toBeNull();
    const baseW = baseBox!.width;

    const modal2 = await openSettings(page);
    const slider2 = modal2.getByLabel('THUMBNAIL SIZE');
    const max = await slider2.evaluate((el) => (el as HTMLInputElement).max);
    expect(Number(max)).toBeGreaterThan(0);
    await setSliderValue(slider2, max);
    await expect(slider2).toHaveValue(max);
    await closeSettings(page);

    await expect.poll(async () => {
      const b = await firstCard.boundingBox();
      return b ? b.width : 0;
    }, { timeout: 5000 }).toBeGreaterThan(baseW * 1.2);
  });

  test('moving slider to the smallest step measurably decreases card width', async ({ page }) => {
    const hasCards = await findCampaignWithCards(page);
    if (!hasCards) {
      test.skip(true, 'No gallery cards available to measure');
    }

    // Start from max for a clear baseline.
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    const max = await slider.evaluate((el) => (el as HTMLInputElement).max);
    await setSliderValue(slider, max);
    await expect(slider).toHaveValue(max);
    await closeSettings(page);

    const firstCard = page.locator('.gallery-grid .card').first();
    const baseBox = await firstCard.boundingBox();
    expect(baseBox).not.toBeNull();
    const baseW = baseBox!.width;

    const modal2 = await openSettings(page);
    const slider2 = modal2.getByLabel('THUMBNAIL SIZE');
    await setSliderValue(slider2, '0');
    await expect(slider2).toHaveValue('0');
    await closeSettings(page);

    await expect.poll(async () => {
      const b = await firstCard.boundingBox();
      return b ? b.width : Number.POSITIVE_INFINITY;
    }, { timeout: 5000 }).toBeLessThan(baseW * 0.9);
  });

  test('selected size index persists after closing and reopening Settings', async ({ page }) => {
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    const max = await slider.evaluate((el) => (el as HTMLInputElement).max);
    expect(Number(max)).toBeGreaterThan(0);

    await setSliderValue(slider, max);
    await expect(slider).toHaveValue(max);
    await closeSettings(page);

    // Reopen and confirm value was preserved (state lives in App).
    const modal2 = await openSettings(page);
    const slider2 = modal2.getByLabel('THUMBNAIL SIZE');
    await expect(slider2).toHaveValue(max);
  });

  test('selected size index is restored from localStorage after reload', async ({ page, context }) => {
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    const max = await slider.evaluate((el) => (el as HTMLInputElement).max);
    expect(Number(max)).toBeGreaterThan(0);

    await setSliderValue(slider, max);
    await expect(slider).toHaveValue(max);

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('fringematrix-a11y'));
      if (!raw) return null;
      try {
        return JSON.parse(raw).thumbnailSizeIndex;
      } catch {
        return null;
      }
    }).toBe(Number(max));

    // Open a fresh page in the same context (shares localStorage) — this
    // simulates a reload without triggering the addInitScript registered
    // in beforeEach, so the persisted value is honoured.
    const freshPage = await context.newPage();
    await freshPage.goto('/');
    await waitForLoader(freshPage);

    const freshModal = await openSettings(freshPage);
    const freshSlider = freshModal.getByLabel('THUMBNAIL SIZE');
    await expect(freshSlider).toHaveValue(max);

    await freshPage.close();
  });

  test('slider step count equals GALLERY_THUMBNAIL_SIZES.length from config', async ({ page }) => {
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    const max = await slider.evaluate((el) => Number((el as HTMLInputElement).max));

    const tickCount = await page.locator('.thumbnail-size-slider-tick').count();

    expect(tickCount).toBeGreaterThan(1);
    expect(max + 1).toBe(tickCount);
  });

  test('zoom-in button is visible in Settings modal and clicking it increases slider value', async ({ page }) => {
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    await setSliderValue(slider, '0');
    await expect(slider).toHaveValue('0');

    const zoomIn = modal.getByRole('button', { name: 'Zoom in' });
    await expect(zoomIn).toBeVisible();
    await expect(zoomIn).toBeEnabled();

    await zoomIn.click();
    await expect(slider).toHaveValue('1');
  });

  test('zoom-out button is visible in Settings modal and clicking it decreases slider value', async ({ page }) => {
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    const max = await slider.evaluate((el) => (el as HTMLInputElement).max);
    await setSliderValue(slider, max);
    await expect(slider).toHaveValue(max);

    const zoomOut = modal.getByRole('button', { name: 'Zoom out' });
    await expect(zoomOut).toBeVisible();
    await expect(zoomOut).toBeEnabled();

    await zoomOut.click();
    await expect(slider).toHaveValue(String(Number(max) - 1));
  });

  test('zoom-in button is disabled at max and zoom-out is disabled at min', async ({ page }) => {
    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');

    await setSliderValue(slider, '0');
    await expect(slider).toHaveValue('0');
    await expect(modal.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    await expect(modal.getByRole('button', { name: 'Zoom in' })).toBeEnabled();

    const max = await slider.evaluate((el) => (el as HTMLInputElement).max);
    await setSliderValue(slider, max);
    await expect(slider).toHaveValue(max);
    await expect(modal.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    await expect(modal.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });

  test('clicking zoom-in button measurably increases card width', async ({ page }) => {
    const hasCards = await findCampaignWithCards(page);
    if (!hasCards) {
      test.skip(true, 'No gallery cards available to measure');
    }

    const modal = await openSettings(page);
    const slider = modal.getByLabel('THUMBNAIL SIZE');
    await setSliderValue(slider, '0');
    await expect(slider).toHaveValue('0');
    await closeSettings(page);

    const firstCard = page.locator('.gallery-grid .card').first();
    const baseBox = await firstCard.boundingBox();
    expect(baseBox).not.toBeNull();
    const baseW = baseBox!.width;

    const modal2 = await openSettings(page);
    const zoomIn = modal2.getByRole('button', { name: 'Zoom in' });
    await zoomIn.click();
    await closeSettings(page);

    await expect.poll(async () => {
      const b = await firstCard.boundingBox();
      return b ? b.width : 0;
    }, { timeout: 5000 }).toBeGreaterThan(baseW);
  });
});
