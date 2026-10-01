import { test, expect, type Page } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';

/**
 * Content modals (History / Credits / Legal): each toolbar button fetches
 * /api/content/<page>, sanitizes it with DOMPurify, and renders it inside a
 * dialog. Focus handling is covered by modal-focus-trap.spec.ts; this file
 * covers content loading, sanitization, dismissal, and the error path.
 */

// page.route() does not see requests handled by a service worker, and the
// PWA's workbox SW caches /api/* (StaleWhileRevalidate). Block it so route
// mocks below are always honored.
test.use({ serviceWorkers: 'block' });

const PAGES = [
  { button: 'History', slug: 'history', title: 'History' },
  { button: 'Credits', slug: 'credits', title: 'Credits' },
  { button: 'Legal', slug: 'legal', title: 'Legal' },
] as const;

async function openContentModal(page: Page, buttonName: string) {
  await page.getByRole('toolbar', { name: 'Primary actions' })
    .getByRole('button', { name: buttonName, exact: true })
    .click();
  const dialog = page.locator('.content-modal-overlay[role="dialog"]');
  await expect(dialog).toBeVisible();
  // Wait for the fetch to settle (the "Loading..." placeholder is replaced
  // by the content div).
  await expect(dialog.locator('.content-modal-loading')).toHaveCount(0);
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForLoaderToFinish(page);
});

test.describe('Content modals', () => {
  for (const p of PAGES) {
    test(`${p.button} modal loads non-empty content from /api/content/${p.slug}`, async ({ page }) => {
      const responsePromise = page.waitForResponse(
        (r) => new URL(r.url()).pathname === `/api/content/${p.slug}`,
      );
      const dialog = await openContentModal(page, p.button);
      const response = await responsePromise;
      expect(response.status()).toBe(200);

      await expect(dialog.locator('#modal-title')).toHaveText(p.title);
      const body = dialog.locator('.content-modal-body');
      await expect(body).not.toContainText('Failed to load content');
      const text = ((await body.innerText()) || '').trim();
      expect(text.length).toBeGreaterThan(20);
      // Rendered content is sanitized: no live <script> elements.
      await expect(body.locator('script')).toHaveCount(0);
    });
  }

  test('content is sanitized: scripts and inline handlers from the API are stripped', async ({ page }) => {
    await page.route('**/api/content/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 'history',
          content:
            '<p id="safe-para">Safe paragraph</p>' +
            '<script>window.__xssScript = true;</script>' +
            '<img id="evil-img" src="data:," onerror="window.__xssHandler = true">' +
            '<a id="evil-link" href="javascript:window.__xssHref=true">link</a>',
        }),
      }),
    );

    const dialog = await openContentModal(page, 'History');
    const body = dialog.locator('.content-modal-body');
    await expect(body.locator('#safe-para')).toHaveText('Safe paragraph');
    await expect(body.locator('script')).toHaveCount(0);

    const img = body.locator('#evil-img');
    if (await img.count()) {
      expect(await img.getAttribute('onerror')).toBeNull();
    }
    const link = body.locator('#evil-link');
    if (await link.count()) {
      const href = await link.getAttribute('href');
      expect(href ?? '').not.toMatch(/^javascript:/i);
    }

    const flags = await page.evaluate(() => ({
      script: (window as unknown as Record<string, unknown>).__xssScript,
      handler: (window as unknown as Record<string, unknown>).__xssHandler,
    }));
    expect(flags.script).toBeUndefined();
    expect(flags.handler).toBeUndefined();
  });

  test('clicking the overlay (outside the modal) closes it; clicking inside does not', async ({ page }) => {
    const dialog = await openContentModal(page, 'Credits');

    // A click inside the modal body must not dismiss it.
    await dialog.locator('.content-modal-body').click();
    await expect(dialog).toBeVisible();

    // The overlay fills the viewport; its top-left corner is outside the
    // centered modal panel.
    await dialog.click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
  });

  test('close button closes the modal', async ({ page }) => {
    const dialog = await openContentModal(page, 'Legal');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  });

  test('a failed content fetch shows "Failed to load content" instead of crashing', async ({ page }) => {
    await page.route('**/api/content/legal', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load content' }),
      }),
    );
    const pageErrors: Error[] = [];
    page.on('pageerror', (e) => pageErrors.push(e));

    const dialog = await openContentModal(page, 'Legal');
    await expect(dialog.locator('.content-modal-body')).toContainText('Failed to load content');

    // The modal is still dismissable and the app keeps working.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    const reopened = await openContentModal(page, 'History');
    await expect(reopened.locator('.content-modal-body')).not.toContainText('Failed to load content');
    expect(pageErrors).toEqual([]);
  });
});
