import { test, expect } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';
import { fetchCampaigns } from './helpers/campaigns';

/**
 * Error handling for the two fetches the app cannot render without:
 * the campaign list and the active campaign's image list. Failures are
 * simulated with page.route so these run identically with or without
 * BLOB_READ_WRITE_TOKEN.
 */

// The PWA service worker caches /api/* — block it so page.route() mocks are
// always honored (route() does not see SW-handled requests).
test.use({ serviceWorkers: 'block' });

test.describe('Error handling', () => {
  test('/api/campaigns failing shows the "loading failed" overlay', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (e) => pageErrors.push(e));

    await page.route('**/api/campaigns', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load campaigns' }),
      }),
    );
    await page.goto('/');

    const overlay = page.getByRole('alertdialog', { name: 'Loading failed' });
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Fringe Matrix loading failed');
    // The normal loader is replaced, not stacked underneath.
    await expect(page.getByRole('dialog', { name: 'Loading' })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('/api/campaigns returning non-JSON (e.g. an HTML error page) also shows the overlay', async ({ page }) => {
    await page.route('**/api/campaigns', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>proxy error</html>' }),
    );
    await page.goto('/');
    await expect(page.getByRole('alertdialog', { name: 'Loading failed' })).toBeVisible();
  });

  test('campaign images endpoint failing renders an empty/error state without crashing', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length === 0, 'No campaigns configured');

    const pageErrors: Error[] = [];
    page.on('pageerror', (e) => pageErrors.push(e));

    await page.route('**/api/campaigns/*/images', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to list images from CDN' }),
      }),
    );
    await page.goto('/');
    await waitForLoaderToFinish(page);

    // The fatal overlay is reserved for the campaign list; a per-campaign
    // failure must leave the app usable.
    await expect(page.getByRole('alertdialog', { name: 'Loading failed' })).toHaveCount(0);

    // Campaign metadata still renders from /api/campaigns.
    await expect(page.locator('#campaign-info h1')).toContainText(campaigns[0].episode);
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[0].hashtag}`);

    // A dedicated error state with Retry, not "No Images In Campaign" and
    // never a grid of broken cards.
    await expect(page.getByRole('alert').filter({ hasText: "Couldn't Load Images" })).toBeVisible();
    await expect(page.getByText('No Images In Campaign')).toHaveCount(0);
    await expect(page.locator('.gallery-grid .card')).toHaveCount(0);

    // The UI is still interactive: the campaign sidebar opens and lists campaigns.
    await page.getByRole('button', { name: 'Campaigns' }).click();
    await expect(page.locator('#campaign-sidebar')).toHaveClass(/open/);
    await expect(page.locator('#campaign-sidebar .sidebar-item')).toHaveCount(campaigns.length);

    expect(pageErrors).toEqual([]);
  });

  test('Retry reloads the images once the endpoint recovers', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    const id = campaigns[0].id;
    let fail = true;
    await page.route(`**/api/campaigns/${id}/images`, (route) =>
      fail
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' })
        : route.continue(),
    );
    await page.goto(`/#${id}`);
    await waitForLoaderToFinish(page);
    await expect(page.getByRole('alert').filter({ hasText: "Couldn't Load Images" })).toBeVisible();

    fail = false;
    const imagesRes = await request.get(`/api/campaigns/${id}/images`);
    const { images } = await imagesRes.json();
    await page.getByRole('button', { name: 'Retry' }).click();
    if (images.length === 0) {
      await expect(page.getByText('No Images In Campaign')).toBeVisible();
    } else {
      await expect(page.locator('.gallery-grid .card').first()).toBeVisible();
    }
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a failed campaign switch recovers when the next campaign loads successfully', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length < 3, 'Need at least 3 campaigns');

    const failingId = campaigns[1].id;
    await page.route(`**/api/campaigns/${failingId}/images`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }),
    );
    await page.goto('/');
    await waitForLoaderToFinish(page);

    const next = page.locator('#top-navbar').getByRole('button', { name: 'Next campaign' });
    await next.click();
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[1].hashtag}`);
    await expect(page.locator('.gallery-grid .card')).toHaveCount(0);

    // Navigation is re-enabled after the failure and the following campaign
    // loads normally.
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[2].hashtag}`);
    await expect(page).toHaveURL(new RegExp(`#${campaigns[2].id}$`));
  });
});
