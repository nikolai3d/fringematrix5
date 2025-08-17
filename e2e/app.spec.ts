import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/local-dev/');
});

test('loader appears then disappears', async ({ page }) => {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  await expect(loader).toBeVisible();
  await loader.waitFor({ state: 'detached' });
});

test('Build Info popover toggles and shows fields', async ({ page }) => {
  // Wait for loader to go away if present
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  await page.getByRole('button', { name: 'Build Info' }).click();
  const buildDialog = page.getByRole('dialog').filter({ hasText: 'Build Info' });
  await expect(buildDialog).toBeVisible();
  await expect(buildDialog.getByText('Repo')).toBeVisible();
  await expect(buildDialog.getByText('Commit')).toBeVisible();
  await expect(buildDialog.getByText('Deployed')).toBeVisible();
  await buildDialog.getByRole('button', { name: 'Close build info' }).click();
  await expect(buildDialog).toBeHidden();
});

test('Share and Build Info are mutually exclusive', async ({ page }) => {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  await page.getByRole('button', { name: 'Share' }).click();
  const shareDialog = page.getByRole('dialog').filter({ hasText: 'Share' });
  await expect(shareDialog).toBeVisible();

  await page.getByRole('button', { name: 'Build Info' }).click();
  const buildDialog = page.getByRole('dialog').filter({ hasText: 'Build Info' });
  await expect(buildDialog).toBeVisible();
  await expect(shareDialog).toBeHidden();
});

test('Sidebar campaign switch updates hash and gallery heading', async ({ page }) => {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  await page.getByRole('button', { name: 'Campaigns' }).click();
  const sidebar = page.locator('#campaign-sidebar');
  await expect(sidebar).toHaveClass(/open/);

  const first = sidebar.getByRole('button').first();
  const firstText = (await first.textContent()) || '';
  await first.click();

  await expect(sidebar).not.toHaveClass(/open/);
  await expect(page).toHaveURL(/#.+/);
  if (firstText.includes('#')) {
    const campaign = firstText.trim();
    await expect(page.getByTestId('current-campaign-top')).toHaveText(campaign);
    await expect(page.getByTestId('current-campaign-bottom')).toHaveText(campaign);
  }
});

test('Lightbox opens and navigates images', async ({ page }) => {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  const firstCard = page.locator('.gallery-grid .card').first();
  const hasCard = await firstCard.isVisible().catch(() => false);
  if (!hasCard) {
    test.skip(true, 'No images available to test lightbox');
  }
  await firstCard.click();

  const lightbox = page.locator('#lightbox');
  await expect(lightbox).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(lightbox).toBeHidden();
});


