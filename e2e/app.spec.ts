import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
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
  await expect(buildDialog.getByText('Repo', { exact: true })).toBeVisible();
  await expect(buildDialog.getByText('Commit', { exact: true })).toBeVisible();
  await expect(buildDialog.getByText('Time of build:', { exact: true })).toBeVisible();

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

test('Build Info shows correct values for environment', async ({ page }) => {
  // Wait for loader to go away if present
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  await page.getByRole('button', { name: 'Build Info' }).click();
  const buildDialog = page.getByRole('dialog').filter({ hasText: 'Build Info' });
  await expect(buildDialog).toBeVisible();
  
  // Check commit row
  const commitRow = buildDialog.locator('.row').nth(1); // Second row after Repo
  await expect(commitRow).toContainText('Commit');
  
  const commitValue = await commitRow.locator('.value').textContent();
  
  if (process.env.CI) {
    // In CI, should show actual commit hash (40 characters)
    expect(commitValue).toMatch(/^[a-f0-9]{40}$/);
  } else {
    // In local development, should show dev-local
    expect(commitValue).toBe('dev-local');
  }
  

  
  // Build time should always have a valid timestamp
  const buildTimeRow = buildDialog.locator('.row').filter({ hasText: 'Time of build:' });
  const buildTimeText = await buildTimeRow.locator('.value').textContent();
  expect(buildTimeText).not.toBe('N/A');
  expect(buildTimeText).not.toBe('');
  
  await buildDialog.getByRole('button', { name: 'Close build info' }).click();
});

test('Build Info displays proper time formats', async ({ page }) => {
  // Wait for loader to go away if present
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  await page.getByRole('button', { name: 'Build Info' }).click();
  const buildDialog = page.getByRole('dialog').filter({ hasText: 'Build Info' });
  await expect(buildDialog).toBeVisible();
  
  // Check that build time is formatted as a readable date in Pacific time
  const buildTimeRow = buildDialog.locator('.row').filter({ hasText: 'Time of build:' });
  const buildTimeValue = buildDialog.locator('.row').filter({ hasText: 'Time of build:' }).locator('.value');
  const buildTimeText = await buildTimeValue.textContent();
  
  if (buildTimeText && buildTimeText !== 'N/A') {
    // Should contain month name, day, year, and time with timezone
    expect(buildTimeText).toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December)/);
    expect(buildTimeText).toMatch(/\d{4}/); // year
    expect(buildTimeText).toMatch(/\d{1,2}:\d{2}:\d{2}/); // time
    expect(buildTimeText).toMatch(/(PST|PDT)/); // Pacific timezone
  }
  
  await buildDialog.getByRole('button', { name: 'Close build info' }).click();
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


