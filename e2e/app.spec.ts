import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loader appears then disappears', async ({ page }) => {
  // Be more specific about which loading dialog we're looking for
  const loader = page.getByRole('dialog', { name: 'Loading' }).locator('.crt-overlay');
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

test('Sidebar campaign switch updates hash and gallery heading with loading', async ({ page }) => {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  await page.getByRole('button', { name: 'Campaigns' }).click();
  const sidebar = page.locator('#campaign-sidebar');
  await expect(sidebar).toHaveClass(/open/);

  const sidebarButtons = sidebar.getByRole('button');
  const buttonCount = await sidebarButtons.count();
  
  if (buttonCount > 1) {
    // Select the second campaign to trigger loading
    const second = sidebarButtons.nth(1);
    const secondText = (await second.textContent()) || '';
    
    await second.click();
    
    // Check for campaign loading content within permanent progress area
    const progressArea = page.getByRole('status', { name: 'Campaign loading status' });
    await expect(progressArea).toBeVisible(); // Progress area should always be visible
    
    const loadingContent = progressArea.locator('.campaign-loading-content');
    if (await loadingContent.isVisible().catch(() => false)) {
      await expect(loadingContent.getByText(/Loading Images/)).toBeVisible();
      await expect(loadingContent.locator('.campaign-progress-bar')).toBeVisible();
      await loadingContent.waitFor({ state: 'detached' });
    }

    await expect(sidebar).not.toHaveClass(/open/);
    await expect(page).toHaveURL(/#.+/);
    if (secondText.includes('#')) {
      const campaign = secondText.trim();
      await expect(page.getByTestId('current-campaign-top')).toHaveText(campaign);
      await expect(page.getByTestId('current-campaign-bottom')).toHaveText(campaign);
    }
  } else {
    // Fallback for single campaign
    const first = sidebarButtons.first();
    await first.click();
    await expect(sidebar).not.toHaveClass(/open/);
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
    // In local development, could show DEV-LOCAL or dev-local depending on build-info.json
    expect(commitValue).toMatch(/^(DEV-LOCAL|dev-local|N\/A)$/);
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

test('Campaign loading disables UI interactions', async ({ page }) => {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  await page.getByRole('button', { name: 'Campaigns' }).click();
  const sidebar = page.locator('#campaign-sidebar');
  await expect(sidebar).toHaveClass(/open/);

  const sidebarButtons = sidebar.getByRole('button');
  const buttonCount = await sidebarButtons.count();
  
  if (buttonCount > 1) {
    // Click a different campaign to trigger loading
    const second = sidebarButtons.nth(1);
    await second.click();
    
    // Check if campaign loading content appears
    const progressArea = page.getByRole('status', { name: 'Campaign loading status' });
    const loadingContent = progressArea.locator('.campaign-loading-content');
    
    if (await loadingContent.isVisible().catch(() => false)) {
      // During loading, navigation buttons should be disabled
      const navButtons = page.locator('.nav-arrow');
      for (let i = 0; i < await navButtons.count(); i++) {
        await expect(navButtons.nth(i)).toBeDisabled();
      }
      
      // Toolbar buttons should be disabled
      await expect(page.getByRole('button', { name: 'Campaigns' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Share' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Build Info' })).toBeDisabled();
      
      // Wait for loading to complete
      await loadingContent.waitFor({ state: 'detached' });
      
      // After loading, buttons should be enabled again
      await expect(page.getByRole('button', { name: 'Campaigns' })).toBeEnabled();
    }
  }
});

test('Campaign loading shows only placeholders, not actual images', async ({ page }) => {
  // Wait for initial loading to complete
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  // Open campaigns sidebar
  await page.getByRole('button', { name: 'Campaigns' }).click();
  const sidebar = page.locator('#campaign-sidebar');
  await expect(sidebar).toHaveClass(/open/);

  const sidebarButtons = sidebar.getByRole('button');
  const buttonCount = await sidebarButtons.count();
  
  if (buttonCount > 1) {
    // Click a different campaign to trigger loading
    const second = sidebarButtons.nth(1);
    await second.click();
    
    // Check for loading state
    const progressArea = page.getByRole('status', { name: 'Campaign loading status' });
    const loadingContent = progressArea.locator('.campaign-loading-content');
    
    if (await loadingContent.isVisible().catch(() => false)) {
      // During loading, should only see placeholders, not actual images
      const placeholders = page.locator('.image-placeholder');
      const placeholderCount = await placeholders.count();
      expect(placeholderCount).toBeGreaterThan(0);
      
      // Verify placeholder content
      await expect(placeholders.first().getByText('Loading...')).toBeVisible();
      
      // Critical test: No img elements should have actual src URLs during loading
      const imageElements = page.locator('.gallery-grid img[src]');
      const imageCount = await imageElements.count();
      
      // If there are img elements with src, they should be minimal/empty
      for (let i = 0; i < imageCount; i++) {
        const imgSrc = await imageElements.nth(i).getAttribute('src');
        // During loading, img src should be null, empty, or just the page URL
        expect(imgSrc === null || imgSrc === '' || imgSrc === await page.url()).toBe(true);
      }
      
      // Wait for loading to complete
      await loadingContent.waitFor({ state: 'detached' });
    }
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


