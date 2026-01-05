import { test, expect, Page } from '@playwright/test';

async function waitForLoaderToFinish(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  const visible = await loader.isVisible().catch(() => false);
  if (visible) await loader.waitFor({ state: 'detached' });
}

async function waitForLightboxAnimationComplete(page: Page, timeout = 3000) {
  // Wait for the wireframe animation to complete (wireframe hidden = animation done)
  await page.waitForFunction(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return true;
    return getComputedStyle(el).display === 'none';
  }, { timeout });
  // Buffer to ensure isAnimatingRef is also set to false after Promise.all resolves
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForLoaderToFinish(page);
});

test.describe('Lightbox Outside Click Behavior', () => {
  test('should close when clicking outside image and outside toolbar', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);

    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Wait for open animation to complete before testing outside click
    await waitForLightboxAnimationComplete(page);

    // Click outside the image and toolbar (top-left corner of lightbox)
    await page.mouse.click(10, 10);

    // Lightbox should close
    await expect(lightbox).toBeHidden();
  });

  test('should close when clicking outside image and outside toolbar (different area)', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);

    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Wait for open animation to complete before testing outside click
    await waitForLightboxAnimationComplete(page);

    // Click outside the image and toolbar (top-right corner of lightbox)
    const lightboxBounds = await lightbox.boundingBox();
    if (lightboxBounds) {
      await page.mouse.click(lightboxBounds.x + lightboxBounds.width - 10, lightboxBounds.y + 10);
    }

    // Lightbox should close
    await expect(lightbox).toBeHidden();
  });

  test('should NOT close when clicking on navigation buttons', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');
    if (count < 2) test.skip(true, 'Need at least 2 images to test navigation');

    const firstImg = cards.nth(0);
    
    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Click on next button
    await page.locator('#next-btn').click();
    await expect(lightbox).toBeVisible();
    
    // Click on previous button
    await page.locator('#prev-btn').click();
    await expect(lightbox).toBeVisible();

    // Close lightbox for cleanup
    await page.keyboard.press('Escape');
  });

  test('should NOT close when clicking on share button', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);
    
    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Click on share button
    await page.locator('#share-btn').click();
    
    // Lightbox should still be open
    await expect(lightbox).toBeVisible();

    // Close lightbox for cleanup
    await page.keyboard.press('Escape');
  });

  test('should NOT close when clicking on the image itself', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);
    
    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Click on the lightbox image
    await page.locator('#lightbox-image').click();
    
    // Lightbox should still be open
    await expect(lightbox).toBeVisible();

    // Close lightbox for cleanup
    await page.keyboard.press('Escape');
  });

  test('should NOT close when clicking on close button (existing functionality)', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);
    
    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Click the close button (this should close it via its own handler, not outside click)
    await page.locator('#lightbox-close').click();
    
    // Lightbox should close
    await expect(lightbox).toBeHidden();
  });

  test('preserve existing keyboard controls', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);
    
    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();

    // Test navigation with arrow keys (if multiple images)
    if (count > 1) {
      await page.keyboard.press('ArrowRight');
      await expect(lightbox).toBeVisible();
      
      await page.keyboard.press('ArrowLeft');
      await expect(lightbox).toBeVisible();
    }

    // Test escape key closes lightbox
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
  });

  test('should close when clicking on main toolbar buttons', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);

    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();
    await waitForLightboxAnimationComplete(page);

    // Click on main toolbar 'Campaigns' button - should close lightbox
    // Use force: true because lightbox overlay covers the button
    await page.locator('button:has-text("Campaigns")').click({ force: true });
    await expect(lightbox).toBeHidden();

    // Open lightbox again
    await firstImg.click();
    await expect(lightbox).toBeVisible();
    await waitForLightboxAnimationComplete(page);

    // Click on main toolbar 'Share' button - should close lightbox
    await page.locator('.toolbar button:has-text("Share")').click({ force: true });
    await expect(lightbox).toBeHidden();

    // Open lightbox again
    await firstImg.click();
    await expect(lightbox).toBeVisible();
    await waitForLightboxAnimationComplete(page);

    // Click on main toolbar 'Build Info' button - should close lightbox
    await page.locator('button:has-text("Build Info")').click({ force: true });
    await expect(lightbox).toBeHidden();
  });

  test('should close when clicking on navigation arrows', async ({ page }) => {
    const cards = page.locator('.gallery-grid .card img');
    const count = await cards.count();
    if (count === 0) test.skip(true, 'No images available to test lightbox');

    const firstImg = cards.nth(0);

    // Open lightbox by clicking first image
    await firstImg.click();

    // Lightbox should be visible
    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();
    await waitForLightboxAnimationComplete(page);

    // Click on navigation arrow in top navbar - should close lightbox
    // Use force: true because lightbox overlay covers the button
    await page.locator('#top-navbar .nav-arrow').first().click({ force: true });
    await expect(lightbox).toBeHidden();

    // Open lightbox again and test bottom navbar
    await firstImg.click();
    await expect(lightbox).toBeVisible();
    await waitForLightboxAnimationComplete(page);

    // Click on navigation arrow in bottom navbar - should close lightbox
    await page.locator('#bottom-navbar .nav-arrow').first().click({ force: true });
    await expect(lightbox).toBeHidden();
  });
});