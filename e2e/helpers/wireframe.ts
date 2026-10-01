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

/**
 * Wait until the lightbox open choreography has fully settled: the wireframe
 * zoom is hidden AND every panel (image frame, details sidebar, nav toolbar)
 * has finished its line -> expand enter animation. `animateLightboxPanel`
 * sets an inline collapsed `clip-path` at the start of the enter sequence and
 * clears it once the expand finishes, so an empty inline clip-path on all
 * present panels means the enter sequence is done.
 *
 * Why this matters: the open effect in useLightboxAnimations only clears its
 * pending thumbnail start-rect after ALL panel animations resolve, and it
 * re-runs whenever `lightboxIndex` changes. Navigating (ArrowLeft/Right)
 * before that point replays the thumbnail -> lightbox wireframe zoom. Tests
 * that navigate right after opening and then assert on the wireframe's
 * resting state must wait for this first.
 *
 * Only meaningful when called after the open animation has started (e.g.
 * after `waitForWireframeVisible`), since the panels also have an empty
 * inline clip-path before the animation begins.
 */
export async function waitForLightboxOpenSettled(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const wf = document.querySelector('.wireframe-rect') as HTMLElement | null;
    if (wf && getComputedStyle(wf).display !== 'none') return false;
    const panels = document.querySelectorAll<HTMLElement>(
      '#lightbox .lightbox-image-wrap, #lightbox .lightbox-details, #lightbox .lightbox-nav-toolbar',
    );
    return Array.from(panels).every((el) => el.style.clipPath === '');
  }, undefined, { timeout });
}
