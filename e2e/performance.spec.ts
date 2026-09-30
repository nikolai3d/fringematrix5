import { test, expect, type ConsoleMessage } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';
import { fetchCampaigns } from './helpers/campaigns';

/**
 * Lightweight performance guardrails. These deliberately avoid timing
 * thresholds (too noisy on shared CI runners) and instead pin down
 * structural properties that regress silently: duplicate API requests on
 * boot, eager-loading every thumbnail, and console errors.
 */

// Count page-level requests only; the PWA service worker would otherwise add
// its own background revalidation fetches.
test.use({ serviceWorkers: 'block' });

// Mirrors EAGER_IMAGE_COUNT in client/src/components/GalleryGrid.tsx.
const EAGER_IMAGE_COUNT = 12;

/**
 * `/_vercel/image` only exists on a Vercel deployment. The production client
 * build rewrites thumbnails to it (client/src/utils/responsiveImage.ts), so
 * under the local `npm start` server those thumbnail requests 404. That is a
 * known environment gap, not a console error this guardrail should flag.
 */
function isKnownEnvironmentNoise(msg: ConsoleMessage): boolean {
  const url = msg.location()?.url ?? '';
  return url.includes('/_vercel/image');
}

test.describe('Performance guardrails', () => {
  test('initial load makes exactly one /api/campaigns and one images request', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length === 0, 'No campaigns configured');

    const campaignsRequests: string[] = [];
    const imagesRequests: string[] = [];
    page.on('request', (r) => {
      const { pathname } = new URL(r.url());
      if (pathname === '/api/campaigns') campaignsRequests.push(pathname);
      else if (/^\/api\/campaigns\/[^/]+\/images$/.test(pathname)) imagesRequests.push(pathname);
    });

    await page.goto('/');
    await waitForLoaderToFinish(page);
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[0].hashtag}`);
    // Give any stray effect-driven refetch a moment to surface before
    // counting. (Not networkidle: dozens of CDN thumbnails keep the network
    // busy well past the point we care about.)
    await page.waitForTimeout(750);

    expect(campaignsRequests).toHaveLength(1);
    expect(imagesRequests).toEqual([`/api/campaigns/${encodeURIComponent(campaigns[0].id)}/images`]);
  });

  test('revisiting a campaign reuses the client cache (no second images request)', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length < 2, 'Need at least 2 campaigns');

    const imagesRequests: string[] = [];
    page.on('request', (r) => {
      const { pathname } = new URL(r.url());
      if (/^\/api\/campaigns\/[^/]+\/images$/.test(pathname)) imagesRequests.push(pathname);
    });

    await page.goto('/');
    await waitForLoaderToFinish(page);
    const next = page.locator('#top-navbar').getByRole('button', { name: 'Next campaign' });
    const prev = page.locator('#top-navbar').getByRole('button', { name: 'Previous campaign' });
    await next.click();
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[1].hashtag}`);
    await expect(prev).toBeEnabled();
    await prev.click();
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[0].hashtag}`);

    expect(imagesRequests).toEqual([
      `/api/campaigns/${encodeURIComponent(campaigns[0].id)}/images`,
      `/api/campaigns/${encodeURIComponent(campaigns[1].id)}/images`,
    ]);
  });

  test(`only the first ${EAGER_IMAGE_COUNT} gallery thumbnails load eagerly; the rest are lazy`, async ({ page }) => {
    await page.goto('/');
    await waitForLoaderToFinish(page);

    const imgs = page.locator('.gallery-grid .card img');
    const count = await imgs.count();
    test.skip(count <= EAGER_IMAGE_COUNT, `Need more than ${EAGER_IMAGE_COUNT} thumbnails mounted`);

    // At scroll position 0 the virtualized grid mounts cards from index 0,
    // so DOM order == image index.
    const attrs = await imgs.evaluateAll((els) =>
      els.map((el) => ({
        loading: el.getAttribute('loading'),
        fetchpriority: el.getAttribute('fetchpriority'),
      })),
    );
    attrs.forEach((a, i) => {
      if (i < EAGER_IMAGE_COUNT) {
        expect(a.loading, `thumbnail ${i} loading`).toBe('eager');
        expect(a.fetchpriority, `thumbnail ${i} fetchpriority`).toBe('high');
      } else {
        expect(a.loading, `thumbnail ${i} loading`).toBe('lazy');
        expect(a.fetchpriority, `thumbnail ${i} fetchpriority`).not.toBe('high');
      }
    });
  });

  test('no console errors or uncaught exceptions during a basic browse session', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length < 2, 'Need at least 2 campaigns');

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isKnownEnvironmentNoise(msg)) {
        errors.push(`${msg.text()} @ ${msg.location()?.url ?? ''}`);
      }
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await page.goto('/');
    await waitForLoaderToFinish(page);

    // Lightbox: open, step forward/back, close.
    const cards = page.locator('.gallery-grid .card img');
    if ((await cards.count()) > 1) {
      await cards.first().click();
      await expect(page.locator('#lightbox')).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Escape');
      await expect(page.locator('#lightbox')).toBeHidden();
    }

    // Switch campaigns via the navbar.
    await page.locator('#top-navbar').getByRole('button', { name: 'Next campaign' }).click();
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[1].hashtag}`);

    // Open and close a content modal.
    await page.getByRole('toolbar', { name: 'Primary actions' })
      .getByRole('button', { name: 'History', exact: true })
      .click();
    const modal = page.locator('.content-modal-overlay');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.content-modal-loading')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // Visit the artists index.
    await page.getByRole('toolbar', { name: 'Primary actions' })
      .getByRole('button', { name: 'Artists', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Artists' })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
