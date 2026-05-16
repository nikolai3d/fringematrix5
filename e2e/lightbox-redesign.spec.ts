import { test, expect, Page } from '@playwright/test';

async function waitForLoaderToFinish(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  const visible = await loader.isVisible().catch(() => false);
  if (visible) await loader.waitFor({ state: 'detached' });
}

async function openLightbox(page: Page): Promise<boolean> {
  const cards = page.locator('.gallery-grid .card img');
  if ((await cards.count()) === 0) return false;
  await cards.nth(0).click();
  await expect(page.locator('#lightbox')).toBeVisible();
  return true;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForLoaderToFinish(page);
});

test.describe('Lightbox redesign — desktop layout', () => {
  test('renders the IMAGE DETAILS sidebar with campaign fields', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');

    const sidebar = page.locator('.lightbox-details').first();
    await expect(sidebar).toBeVisible();

    // Heading.
    await expect(sidebar.getByText('IMAGE DETAILS')).toBeVisible();

    // SEASON / NUMBER row — value follows the "S<season> · E<episode> (<id>)" format.
    await expect(sidebar.getByText(/S\d+\s*·\s*E\d+\s*\(\d+\.\d+\)/)).toBeVisible();

    // HASHTAG row — value starts with '#'.
    await expect(sidebar.getByText(/^#\w+/)).toBeVisible();
  });

  test('Download and Share buttons are gone from the lightbox', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');
    await expect(page.locator('#download-btn')).toHaveCount(0);
    await expect(page.locator('#share-btn')).toHaveCount(0);
    await expect(page.locator('.lightbox-actions')).toHaveCount(0);
  });

  test('IMDB link is external, opens in new tab, and matches the campaign url', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');
    const link = page.locator('.lightbox-details .lightbox-details-link').first();
    const visible = await link.isVisible().catch(() => false);
    if (!visible) test.skip(true, 'Campaign has no imdb_link');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    const href = await link.getAttribute('href');
    expect(href).toMatch(/imdb\.com|tt\d+/);
  });
});

test.describe('Lightbox redesign — bottom nav toolbar', () => {
  test('PREVIOUS and NEXT buttons advance the lightbox index', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count < 2) test.skip(true, 'Need at least 2 images');
    if (!(await openLightbox(page))) test.skip(true, 'No images available');

    const hud = page.locator('.lightbox-hud');
    const initial = await hud.innerText();

    // Click the redesigned NEXT pill in the bottom toolbar (not the side ▶ arrow).
    await page.locator('.lightbox-nav-toolbar').getByRole('button', { name: /next image/i }).click();
    await expect(hud).not.toHaveText(initial);

    // Click PREVIOUS pill — should return to the original index.
    await page.locator('.lightbox-nav-toolbar').getByRole('button', { name: /previous image/i }).click();
    await expect(hud).toHaveText(initial);
  });

  test('the bottom NEXT button is styled as the primary action', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');
    const next = page.locator('.lightbox-nav-toolbar .lightbox-nav-btn--primary');
    await expect(next).toBeVisible();
    await expect(next).toContainText(/next/i);
  });
});

test.describe('Lightbox redesign — accessibility', () => {
  test('lightbox is a dialog with aria-modal and initial focus on Close', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');

    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toHaveAttribute('role', 'dialog');
    await expect(lightbox).toHaveAttribute('aria-modal', 'true');

    // Close button should hold initial focus.
    const focusId = await page.evaluate(() => document.activeElement?.id);
    expect(focusId).toBe('lightbox-close');
  });

  test('Escape closes the lightbox', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

test.describe('Lightbox redesign — mobile drawer', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('inline sidebar is hidden and info button toggles the drawer', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');

    // Inline sidebar should be display:none on narrow viewports (the
    // element still exists in the DOM — verify it is not visible).
    const inlineSidebar = page.locator('.lightbox-details').first();
    await expect(inlineSidebar).toBeHidden();

    // Info button is visible on mobile.
    const infoBtn = page.locator('.lightbox-info-btn');
    await expect(infoBtn).toBeVisible();

    // Toggle drawer open.
    await infoBtn.click();
    const drawer = page.locator('.lightbox-details-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('role', 'dialog');
    await expect(drawer).toHaveAttribute('aria-modal', 'true');

    // Escape closes the drawer first (layered modal pattern).
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.locator('#lightbox')).toBeVisible();

    // A second Escape closes the lightbox itself.
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

test.describe('Lightbox redesign — reduce-effects', () => {
  test('enabling reduce-motion bypasses the sidebar clip-path animation', async ({ page }) => {
    if (!(await openLightbox(page))) test.skip(true, 'No images available');
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();

    // Toggle reduce-motion via the html class directly. The in-app
    // settings toggle drives the same class, so this is functionally
    // equivalent for the animation-bypass code path.
    await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));

    if (!(await openLightbox(page))) test.skip(true, 'No images available');

    // Read the computed clip-path of the sidebar. With the animation
    // bypassed it should NOT be the mid-line collapsed inset.
    const clipPath = await page.locator('.lightbox-details').first().evaluate((el) => {
      return getComputedStyle(el).clipPath;
    });
    expect(clipPath).not.toMatch(/inset\(\s*calc\(\s*50%/);

    // Cleanup so subsequent tests don't inherit the class.
    await page.evaluate(() => document.documentElement.classList.remove('reduce-motion'));
  });
});
