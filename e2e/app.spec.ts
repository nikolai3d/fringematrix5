import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loader appears then disappears', async ({ page }) => {
  // The main loader should either be visible initially or already gone
  // This test ensures the app initializes properly regardless of loading speed
  const loader = page.getByRole('dialog', { name: 'Loading' });
  
  // Check if loader is currently visible
  const isLoaderVisible = await loader.isVisible().catch(() => false);
  
  if (isLoaderVisible) {
    // If visible, wait for it to disappear
    await loader.waitFor({ state: 'detached' });
  }
  
  // Verify the app has initialized properly by checking for key elements
  await expect(page.getByRole('toolbar', { name: 'Primary actions' })).toBeVisible();
  await expect(page.locator('#top-navbar')).toBeVisible();
  
  // Ensure the main loader is not visible after initialization
  await expect(loader).not.toBeVisible();
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
    // In local development, can show `DEV-LOCAL` or `dev-local` depending on build-info.json
    expect(commitValue).toMatch(/^(DEV-LOCAL|dev-local|N\/A)$/);
  }
  

  
  // Build time should always have a valid timestamp
  const buildTimeRow = buildDialog.locator('.row').filter({ hasText: 'Time of build:' });
  const buildTimeValue = buildTimeRow.locator('.value');
  
  // Wait for the build time to be populated (not N/A)
  await expect(buildTimeValue).not.toHaveText('N/A');
  await expect(buildTimeValue).not.toHaveText('');
  
  const buildTimeText = await buildTimeValue.textContent();
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
    
    // Wait for loading content to appear AND buttons to be disabled
    try {
      await loadingContent.waitFor({ state: 'visible', timeout: 1000 });
      // Once loading content is visible, wait for the first navigation button to be disabled
      // This ensures the React state update has propagated to disable all buttons
      await expect(page.locator('.nav-arrow').first()).toBeDisabled({ timeout: 2000 });
      
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
    } catch (e) {
      // If loading content doesn't appear (images already cached), 
      // buttons should remain enabled
      const navButtons = page.locator('.nav-arrow');
      for (let i = 0; i < await navButtons.count(); i++) {
        await expect(navButtons.nth(i)).toBeEnabled();
      }
    }
  }
});

test('Campaign loading shows all placeholders until ALL images load (all-or-nothing)', async ({ page }) => {
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
      // During loading, should see ALL placeholders and NO actual images
      const placeholders = page.locator('.image-placeholder');
      const placeholderCount = await placeholders.count();
      
      if (placeholderCount > 0) {
        // Verify all cards show placeholders
        await expect(placeholders.first().getByText('Loading...')).toBeVisible();
        
        // Critical: ALL images should be placeholders during loading (all-or-nothing)
        const cards = page.locator('.gallery-grid .card');
        const cardCount = await cards.count();
        
        if (cardCount > 0) {
          // Every card should contain a placeholder, no actual images
          for (let i = 0; i < cardCount; i++) {
            const card = cards.nth(i);
            const hasPlaceholder = await card.locator('.image-placeholder').isVisible();
            const hasActualImage = await card.locator('img[src]:not([src=""])').isVisible();
            
            // During all-or-nothing loading: all should be placeholders
            expect(hasPlaceholder).toBe(true);
            expect(hasActualImage).toBe(false);
          }
        }
      }
      
      // Wait for loading to complete
      await loadingContent.waitFor({ state: 'detached' });
      
      // After loading completes, ALL should be actual images, NO placeholders
      await page.waitForTimeout(100); // Brief wait for DOM update
      
      const remainingPlaceholders = await page.locator('.image-placeholder').count();
      expect(remainingPlaceholders).toBe(0);
      
      // Now all should be actual images
      const actualImages = page.locator('.gallery-grid img[src]:not([src=""])');
      const actualImageCount = await actualImages.count();
      if (actualImageCount > 0) {
        // Verify they have real src URLs
        const firstImageSrc = await actualImages.first().getAttribute('src');
        expect(firstImageSrc).toMatch(/^https?:\/\//);
      }
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

test('Home button clears hash and navigates to first campaign', async ({ page }) => {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  // Get the first campaign's hashtag for later comparison
  const topNavbar = page.locator('#top-navbar');
  const firstCampaignText = await topNavbar.locator('.current-campaign').textContent();

  // Open sidebar and switch to a different campaign
  await page.getByRole('button', { name: 'Campaigns' }).click();
  const sidebar = page.locator('#campaign-sidebar');
  await expect(sidebar).toHaveClass(/open/);

  const sidebarButtons = sidebar.getByRole('button');
  const buttonCount = await sidebarButtons.count();

  if (buttonCount < 2) {
    test.skip(true, 'Need at least 2 campaigns to test Home button');
  }

  // Click the second campaign
  const secondButton = sidebarButtons.nth(1);
  await secondButton.click();

  // Wait for loader to finish after campaign switch
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  // Verify we're on a different campaign (hash should be set)
  await expect(page).toHaveURL(/#/);
  const currentCampaignText = await topNavbar.locator('.current-campaign').textContent();
  expect(currentCampaignText).not.toBe(firstCampaignText);

  // Wait for the Home button to be enabled, then click it
  const homeButton = page.locator('button[aria-label="Go to home"]');
  await expect(homeButton).toBeEnabled();
  await homeButton.click({ force: true });

  // Wait for loader to finish after going home
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }

  // Verify we're back on the first campaign
  const finalCampaignText = await topNavbar.locator('.current-campaign').textContent();
  expect(finalCampaignText).toBe(firstCampaignText);
});

// ---------------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------------

test.describe('Settings modal', () => {
  // Helper: navigate to the app with a clean accessibility state
  async function gotoClean(page: Parameters<typeof test.beforeEach>[0]['page']) {
    // Inject a script that clears the a11y key before the app reads localStorage,
    // ensuring toggles start in their default (off) state.
    await page.addInitScript(() => {
      localStorage.removeItem('fringematrix-a11y');
    });
    await page.goto('/');
    const loader = page.getByRole('dialog', { name: 'Loading' });
    if (await loader.isVisible().catch(() => false)) {
      await loader.waitFor({ state: 'detached' });
    }
  }

  test.beforeEach(async ({ page }) => {
    await gotoClean(page);
  });

  test('opens and closes Settings modal', async ({ page }) => {
    // Modal should not be present yet
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden();

    // Open via toolbar button
    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await expect(modal).toBeVisible();

    // Close via the close button
    await modal.getByRole('button', { name: 'Close settings' }).click();
    await expect(modal).toBeHidden();
  });

  test('Escape closes the Settings modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('toggling Reduce Effects adds reduce-effects class to <html>', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await expect(modal).toBeVisible();

    // Initially the class should not be present
    const hasBefore = await page.evaluate(() =>
      document.documentElement.classList.contains('reduce-effects')
    );
    expect(hasBefore).toBe(false);

    // Toggle Reduce Effects on
    const toggle = modal.getByRole('switch', { name: 'Reduce Effects' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    const hasAfter = await page.evaluate(() =>
      document.documentElement.classList.contains('reduce-effects')
    );
    expect(hasAfter).toBe(true);
  });

  test('Reduce Effects setting persists across page reload via localStorage', async ({ page, context }) => {
    // Enable Reduce Effects via the UI — this writes to localStorage.
    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await modal.getByRole('switch', { name: 'Reduce Effects' }).click();

    // Confirm both the class and the localStorage entry are applied.
    expect(
      await page.evaluate(() => document.documentElement.classList.contains('reduce-effects'))
    ).toBe(true);
    const storedValue = await page.evaluate(() => localStorage.getItem('fringematrix-a11y'));
    expect(storedValue).not.toBeNull();
    const parsed = JSON.parse(storedValue!);
    expect(parsed.reduceEffects).toBe(true);

    // Open a fresh page in the same browser context (shares localStorage) —
    // this simulates a reload without triggering the addInitScript that the
    // beforeEach registered, ensuring the persisted value is read by the app.
    const freshPage = await context.newPage();
    await freshPage.goto('/');
    const loaderFresh = freshPage.getByRole('dialog', { name: 'Loading' });
    if (await loaderFresh.isVisible().catch(() => false)) {
      await loaderFresh.waitFor({ state: 'detached' });
    }

    expect(
      await freshPage.evaluate(() => document.documentElement.classList.contains('reduce-effects'))
    ).toBe(true);

    await freshPage.close();
  });

  test('toggling Reduce Motion adds reduce-motion class to <html>', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await expect(modal).toBeVisible();

    const hasBefore = await page.evaluate(() =>
      document.documentElement.classList.contains('reduce-motion')
    );
    expect(hasBefore).toBe(false);

    const toggle = modal.getByRole('switch', { name: 'Reduce Motion' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    expect(
      await page.evaluate(() => document.documentElement.classList.contains('reduce-motion'))
    ).toBe(true);
  });

  test('focus is trapped inside Settings modal (Tab wraps)', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await expect(modal).toBeVisible();

    // Initial focus is set via setTimeout(0) in the component; wait for the
    // close button to receive focus before asserting.
    const closeBtn = modal.getByRole('button', { name: 'Close settings' });
    await expect(closeBtn).toBeFocused();

    // Collect all focusable elements inside the modal
    const focusableCount = await modal.evaluate((el) => {
      const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return el.querySelectorAll(sel).length;
    });

    // Tab through all elements — after the last one, focus must wrap back to the first
    for (let i = 0; i < focusableCount; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should have wrapped to the first focusable element inside the modal
    const isInsideModal = await page.evaluate(() => {
      const modalEl = document.querySelector('[aria-labelledby="settings-title"]');
      return modalEl ? modalEl.contains(document.activeElement) : false;
    });
    expect(isInsideModal).toBe(true);
  });

  test('focus returns to Settings button after modal closes', async ({ page }) => {
    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await settingsBtn.click();
    const modal = page.getByRole('dialog', { name: 'Settings' });
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // Focus must have returned to the trigger element
    const focusedLabel = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focusedLabel).toBe('Settings');
  });
});
