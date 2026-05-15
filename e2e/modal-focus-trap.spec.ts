/**
 * Tests for the focus-management contract documented in
 * client/src/components/ContentModal.tsx (items 1-6):
 *
 *  1. Trigger element stored on open (for focus restoration).
 *  2. Focus moves to the close button when the modal opens.
 *  3. Tab key is trapped inside the modal (wraps at both ends).
 *  4. Escape key closes the modal.
 *  5. Focus returns to the trigger element when the modal closes.
 *  6. If no trigger element exists, focus restoration is safely skipped.
 */

import { test, expect, type Page } from '@playwright/test';

async function waitForLoaderToFinish(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  const visible = await loader.isVisible().catch(() => false);
  if (visible) await loader.waitFor({ state: 'detached' });
}

/** Open the History modal via the toolbar button and return the modal locator. */
async function openHistoryModal(page: Page) {
  const historyBtn = page.getByRole('button', { name: 'History' });
  await expect(historyBtn).toBeEnabled();
  await historyBtn.click();
  const modal = page.getByRole('dialog', { name: 'History' });
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('ContentModal focus-trap contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForLoaderToFinish(page);
  });

  // -------------------------------------------------------------------------
  // Contract item 2: focus lands on close button when modal opens
  // -------------------------------------------------------------------------
  test('focus is on the close button immediately after opening', async ({ page }) => {
    await openHistoryModal(page);

    // Give the setTimeout(0) in ContentModal a tick to fire
    await page.waitForTimeout(50);

    const closeBtn = page.getByRole('button', { name: 'Close' });
    await expect(closeBtn).toBeFocused();
  });

  // -------------------------------------------------------------------------
  // Contract item 3: Tab cycles within the modal
  //   The modal contains exactly one focusable element (the close button) when
  //   no HTML links are present in the loaded content, OR multiple elements
  //   when links/buttons exist.  We test both forward and backward wrapping.
  // -------------------------------------------------------------------------
  test('Tab cycles through focusable elements within the modal', async ({ page }) => {
    await openHistoryModal(page);
    await page.waitForTimeout(50); // wait for auto-focus timer

    // Collect focusable elements inside the modal
    const modal = page.getByRole('dialog', { name: 'History' });
    const focusables = modal.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const count = await focusables.count();

    if (count <= 1) {
      // Only the close button — Tab should keep focus on it (wrap back to itself)
      await page.keyboard.press('Tab');
      await expect(focusables.first()).toBeFocused();
    } else {
      // Multiple elements: Tab should move forward, then wrap at the last element
      // Start from close button (first element, auto-focused)
      for (let i = 1; i < count; i++) {
        await page.keyboard.press('Tab');
        await expect(focusables.nth(i)).toBeFocused();
      }
      // One more Tab from the last element should wrap to the first
      await page.keyboard.press('Tab');
      await expect(focusables.first()).toBeFocused();
    }
  });

  test('Shift+Tab cycles backwards within the modal', async ({ page }) => {
    await openHistoryModal(page);
    await page.waitForTimeout(50); // wait for auto-focus timer

    const modal = page.getByRole('dialog', { name: 'History' });
    const focusables = modal.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const count = await focusables.count();

    if (count <= 1) {
      // Shift+Tab from the only element should wrap back to itself
      await page.keyboard.press('Shift+Tab');
      await expect(focusables.first()).toBeFocused();
    } else {
      // Shift+Tab from the first element wraps to the last
      await page.keyboard.press('Shift+Tab');
      await expect(focusables.last()).toBeFocused();
    }
  });

  // -------------------------------------------------------------------------
  // Contract item 4: Escape closes the modal
  // -------------------------------------------------------------------------
  test('Escape key closes the modal', async ({ page }) => {
    await openHistoryModal(page);
    await page.keyboard.press('Escape');
    const modal = page.getByRole('dialog', { name: 'History' });
    await expect(modal).toBeHidden();
  });

  // -------------------------------------------------------------------------
  // Contract items 1 & 5: focus returns to the trigger element on close
  // -------------------------------------------------------------------------
  test('focus returns to the trigger button when the modal is closed via Escape', async ({ page }) => {
    const historyBtn = page.getByRole('button', { name: 'History' });
    await expect(historyBtn).toBeEnabled();
    await historyBtn.click();
    await expect(page.getByRole('dialog', { name: 'History' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'History' })).toBeHidden();

    // Focus should have been restored to the button that opened the modal
    await expect(historyBtn).toBeFocused();
  });

  test('focus returns to the trigger button when the modal is closed via close button', async ({ page }) => {
    const historyBtn = page.getByRole('button', { name: 'History' });
    await expect(historyBtn).toBeEnabled();
    await historyBtn.click();
    await expect(page.getByRole('dialog', { name: 'History' })).toBeVisible();
    await page.waitForTimeout(50); // allow auto-focus timer

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'History' })).toBeHidden();

    await expect(historyBtn).toBeFocused();
  });

  // -------------------------------------------------------------------------
  // Bonus: Tab does NOT escape the modal (focus stays inside at all times)
  // -------------------------------------------------------------------------
  test('focus does not leave the modal after repeated Tab presses', async ({ page }) => {
    await openHistoryModal(page);
    await page.waitForTimeout(50);

    const modal = page.getByRole('dialog', { name: 'History' });

    // Press Tab many times — focus must always remain inside the modal
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const activeHandle = await page.evaluateHandle(() => document.activeElement);
      const isInsideModal = await page.evaluate((el) => {
        const dialog = document.querySelector('[role="dialog"][aria-labelledby="modal-title"]');
        return dialog ? dialog.contains(el) : false;
      }, activeHandle);
      expect(isInsideModal).toBe(true);
    }

    // Clean up
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
});
