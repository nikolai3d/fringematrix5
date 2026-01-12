import { test, expect } from '@playwright/test';

/**
 * Loading Screen Tests
 *
 * These tests verify that the loading screen system works correctly.
 * The VITE_LOADING_SCREEN environment variable controls which loading screen is shown.
 *
 * To test different loading screens:
 * 1. Set VITE_LOADING_SCREEN environment variable before building
 * 2. Rebuild the client: npm run build:client
 * 3. Run these tests: npm run test:e2e -- loading-screens.spec.ts
 *
 * Example:
 *   VITE_LOADING_SCREEN=legacy npm run build:client && npm run test:e2e -- loading-screens.spec.ts
 *   VITE_LOADING_SCREEN=glyphs npm run build:client && npm run test:e2e -- loading-screens.spec.ts
 */

test.describe('Loading Screen - Terminal variant', () => {
  test('shows terminal loading screen with correct elements', async ({ page }) => {
    /**
     * This test runs in CI when built with VITE_LOADING_SCREEN=terminal
     * To run locally:
     * 1. Build with terminal loading screen: VITE_LOADING_SCREEN=terminal npm run build:client
     * 2. Run this test: npm run test:e2e -- loading-screens.spec.ts --grep "Terminal"
     */
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });

    // Check if loader is visible (may have already disappeared on fast connections)
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      // Verify terminal-specific elements
      const terminal = loader.locator('.loading-terminal');
      await expect(terminal).toBeVisible();

      // Check for terminal header
      const terminalTitle = terminal.locator('.terminal-title');
      await expect(terminalTitle).toBeVisible();
      await expect(terminalTitle).toContainText('FRINGE DIVISION');

      // Check for terminal status indicator
      const terminalStatus = terminal.locator('.terminal-status');
      await expect(terminalStatus).toBeVisible();
      await expect(terminalStatus).toHaveText('CONNECTED');

      // Check for terminal body with content
      const terminalBody = terminal.locator('.terminal-body');
      await expect(terminalBody).toBeVisible();

      // Check for scanlines effect
      const scanlines = terminal.locator('.terminal-scanlines');
      await expect(scanlines).toBeVisible();

      // Verify terminal content area exists
      const terminalContent = terminal.locator('.terminal-content');
      await expect(terminalContent).toBeVisible();

      // Wait for loader to disappear
      await loader.waitFor({ state: 'detached', timeout: 30000 });
    }

    // Verify app loaded successfully
    await expect(page.getByRole('toolbar', { name: 'Primary actions' })).toBeVisible();
  });

  test('terminal loading screen shows typing animation', async ({ page }) => {
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      const terminal = loader.locator('.loading-terminal');

      // Look for terminal lines (visible lines from the typing effect)
      const terminalLines = terminal.locator('.terminal-line');

      // Should have at least one terminal line visible
      await expect(terminalLines.first()).toBeVisible();

      // Check for cursor element (part of typing animation)
      const cursor = terminal.locator('.terminal-cursor');
      await expect(cursor.first()).toBeVisible();

      await loader.waitFor({ state: 'detached', timeout: 30000 });
    }
  });

  test('terminal loading screen can be skipped when data is ready', async ({ page }) => {
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      // Wait for skip hint to appear (indicates data is ready)
      const skipHint = loader.locator('.terminal-skip');
      await skipHint.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const isSkipVisible = await skipHint.isVisible().catch(() => false);

      if (isSkipVisible) {
        // Verify skip hint text
        await expect(skipHint).toContainText('Press ENTER, SPACE, or click');

        // Test clicking to skip
        await loader.click();

        // Loader should disappear quickly after clicking
        await expect(loader).not.toBeVisible({ timeout: 2000 });
      } else {
        // If skip hint not visible, loader should auto-complete
        await loader.waitFor({ state: 'detached', timeout: 30000 });
      }
    }

    // Verify app is functional
    await expect(page.getByRole('toolbar', { name: 'Primary actions' })).toBeVisible();
  });

  test('terminal loading screen responds to keyboard skip (Enter key)', async ({ page }) => {
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      // Wait for skip hint to appear (indicates data is ready)
      const skipHint = loader.locator('.terminal-skip');
      await skipHint.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const isSkipVisible = await skipHint.isVisible().catch(() => false);

      if (isSkipVisible) {
        // Press Enter to skip
        await page.keyboard.press('Enter');

        // Loader should disappear quickly
        await expect(loader).not.toBeVisible({ timeout: 2000 });
      }
    }
  });
});

test.describe('Loading Screen - Legacy variant', () => {
  test('shows legacy loading screen with correct elements', async ({ page }) => {
    /**
     * This test runs in CI when built with VITE_LOADING_SCREEN=legacy
     * To run locally:
     * 1. Build with legacy loading screen: VITE_LOADING_SCREEN=legacy npm run build:client
     * 2. Run this test: npm run test:e2e -- loading-screens.spec.ts --grep "Legacy"
     */
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      // Verify legacy-specific elements
      const legacyContent = loader.locator('.legacy-loading-content');
      await expect(legacyContent).toBeVisible();

      // Check for legacy loading text
      const loadingText = loader.locator('.legacy-loading-text');
      await expect(loadingText).toBeVisible();
      await expect(loadingText).toContainText('Fringe Matrix 5 Loading');

      // Should NOT have terminal elements
      await expect(loader.locator('.loading-terminal')).not.toBeVisible();

      // Wait for skip hint to appear (indicates data is ready)
      const skipHint = loader.locator('.legacy-skip-hint');
      await skipHint.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await skipHint.isVisible().catch(() => false)) {
        await expect(skipHint).toContainText('Press ENTER, SPACE, or click');
      }

      await loader.waitFor({ state: 'detached', timeout: 30000 });
    }

    await expect(page.getByRole('toolbar', { name: 'Primary actions' })).toBeVisible();
  });
});

test.describe('Loading Screen - Glyphs (default)', () => {
  test('shows glyphs loading screen with correct elements', async ({ page }) => {
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      // Verify glyphs-specific elements
      const glyphsContainer = loader.locator('.glyphs-loading-container');
      await expect(glyphsContainer).toBeVisible();

      // Check for glyphs spinner wrapper
      const spinnerWrapper = loader.locator('.glyphs-spinner-wrapper');
      await expect(spinnerWrapper).toBeVisible();

      // Should NOT have terminal elements
      await expect(loader.locator('.loading-terminal')).not.toBeVisible();
      // Should NOT have legacy elements
      await expect(loader.locator('.legacy-loading-content')).not.toBeVisible();

      // Wait for skip hint to appear (indicates data is ready)
      const skipHint = loader.locator('.glyphs-skip-hint');
      await skipHint.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await skipHint.isVisible().catch(() => false)) {
        await expect(skipHint).toContainText('Press ENTER, SPACE, or click');
      }

      await loader.waitFor({ state: 'detached', timeout: 30000 });
    }

    await expect(page.getByRole('toolbar', { name: 'Primary actions' })).toBeVisible();
  });

  test('glyphs loading screen can be skipped when data is ready', async ({ page }) => {
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      // Wait for skip hint to appear (indicates data is ready)
      const skipHint = loader.locator('.glyphs-skip-hint');
      await skipHint.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const isSkipVisible = await skipHint.isVisible().catch(() => false);

      if (isSkipVisible) {
        // Verify skip hint text
        await expect(skipHint).toContainText('Press ENTER, SPACE, or click');

        // Test clicking to skip
        await loader.click();

        // Loader should disappear quickly after clicking
        await expect(loader).not.toBeVisible({ timeout: 2000 });
      } else {
        // If skip hint not visible, loader should auto-complete
        await loader.waitFor({ state: 'detached', timeout: 30000 });
      }
    }

    // Verify app is functional
    await expect(page.getByRole('toolbar', { name: 'Primary actions' })).toBeVisible();
  });

  test('glyphs loading screen responds to keyboard skip (Enter key)', async ({ page }) => {
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });
    const isLoaderVisible = await loader.isVisible().catch(() => false);

    if (isLoaderVisible) {
      // Wait for skip hint to appear (indicates data is ready)
      const skipHint = loader.locator('.glyphs-skip-hint');
      await skipHint.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const isSkipVisible = await skipHint.isVisible().catch(() => false);

      if (isSkipVisible) {
        // Press Enter to skip
        await page.keyboard.press('Enter');

        // Loader should disappear quickly
        await expect(loader).not.toBeVisible({ timeout: 2000 });
      }
    }
  });
});

test.describe('Loading Screen - Configuration (runs for all variants)', () => {
  test('loading screen eventually completes and shows main app', async ({ page }) => {
    await page.goto('/');

    const loader = page.getByRole('dialog', { name: 'Loading' });

    // Wait for loader to complete (if visible)
    if (await loader.isVisible().catch(() => false)) {
      await loader.waitFor({ state: 'detached', timeout: 30000 });
    }

    // Verify all main UI elements are present after loading
    await expect(page.getByRole('toolbar', { name: 'Primary actions' })).toBeVisible();
    await expect(page.locator('#top-navbar')).toBeVisible();
    await expect(page.locator('#campaign-info')).toBeVisible();

    // Loader should not reappear
    await expect(loader).not.toBeVisible();
  });

  test('loading screen does not block app functionality', async ({ page }) => {
    await page.goto('/');

    // Wait for any loading to complete
    const loader = page.getByRole('dialog', { name: 'Loading' });
    if (await loader.isVisible().catch(() => false)) {
      await loader.waitFor({ state: 'detached', timeout: 30000 });
    }

    // Test that app is fully functional
    await expect(page.getByRole('button', { name: 'Campaigns' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Build Info' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled();
  });
});
