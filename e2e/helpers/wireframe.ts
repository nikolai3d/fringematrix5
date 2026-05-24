import type { Page } from '@playwright/test';

/**
 * Wait for the global "Loading" dialog (the splash / glyphs / terminal
 * loader, depending on config) to detach from the DOM. Safe to call when
 * the loader is already gone — does nothing in that case.
 */
export async function waitForLoaderToFinish(page: Page): Promise<void> {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }
}

/**
 * Wait until the lightbox wireframe rect (the thin blinking line that
 * morphs into / out of each panel) is visible per its computed `display`.
 */
export async function waitForWireframeVisible(page: Page, timeout = 3000): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none';
  }, { timeout });
}

/**
 * Wait until the lightbox wireframe rect is hidden (display: none) or
 * absent from the DOM entirely.
 */
export async function waitForWireframeHidden(page: Page, timeout = 3000): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (!el) return true;
    return getComputedStyle(el).display === 'none';
  }, { timeout });
}
