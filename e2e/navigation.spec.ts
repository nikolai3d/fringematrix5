import { test, expect, type Page, type Locator } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';
import { fetchCampaigns, type CampaignSummary } from './helpers/campaigns';

/**
 * Hash-based navigation: campaign prev/next switchers (NavSwitcher in the
 * top and bottom navbars), deep links, invalid-hash fallback, and the
 * #authors / #authors/<handle> routes with browser history.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectActiveCampaign(page: Page, c: CampaignSummary) {
  await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${c.hashtag}`);
  await expect(page.getByTestId('current-campaign-bottom')).toHaveText(`#${c.hashtag}`);
  await expect(page.locator('#campaign-info h1')).toHaveText(`${c.episode} (${c.episode_id})`);
  await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(c.id)}$`));
}

function navButton(page: Page, bar: 'top' | 'bottom', which: 'Previous' | 'Next'): Locator {
  const barSel = bar === 'top' ? '#top-navbar' : '#bottom-navbar';
  return page.locator(barSel).getByRole('button', { name: `${which} campaign` });
}

test.describe('Campaign prev/next navigation', () => {
  let campaigns: CampaignSummary[] = [];

  test.beforeEach(async ({ page, request }) => {
    campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length < 2, 'Need at least 2 campaigns');
    await page.goto('/');
    await waitForLoaderToFinish(page);
    await expectActiveCampaign(page, campaigns[0]);
  });

  test('top navbar Next/Previous update heading and hash', async ({ page }) => {
    await navButton(page, 'top', 'Next').click();
    await expectActiveCampaign(page, campaigns[1]);

    await expect(navButton(page, 'top', 'Previous')).toBeEnabled();
    await navButton(page, 'top', 'Previous').click();
    await expectActiveCampaign(page, campaigns[0]);
  });

  test('bottom navbar Next/Previous update heading and hash', async ({ page }) => {
    await navButton(page, 'bottom', 'Next').click();
    await expectActiveCampaign(page, campaigns[1]);

    await expect(navButton(page, 'bottom', 'Previous')).toBeEnabled();
    await navButton(page, 'bottom', 'Previous').click();
    await expectActiveCampaign(page, campaigns[0]);
  });

  test('Previous on the first campaign wraps to the last, Next on the last wraps to the first', async ({ page }) => {
    const last = campaigns[campaigns.length - 1];
    await navButton(page, 'top', 'Previous').click();
    await expectActiveCampaign(page, last);

    await expect(navButton(page, 'bottom', 'Next')).toBeEnabled();
    await navButton(page, 'bottom', 'Next').click();
    await expectActiveCampaign(page, campaigns[0]);
  });
});

test.describe('Deep links', () => {
  test('/#<campaignId> loads that campaign directly', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length < 3, 'Need at least 3 campaigns');
    // Pick a campaign that is neither first nor last so a fallback to the
    // default campaign can't pass by accident.
    const target = campaigns[Math.floor(campaigns.length / 2)];

    const imagesRequests: string[] = [];
    page.on('request', (r) => {
      const { pathname } = new URL(r.url());
      if (/^\/api\/campaigns\/[^/]+\/images$/.test(pathname)) imagesRequests.push(pathname);
    });

    await page.goto(`/#${target.id}`);
    await waitForLoaderToFinish(page);
    await expectActiveCampaign(page, target);

    // Only the deep-linked campaign's images are fetched (the first
    // campaign is not loaded and then swapped out).
    expect(imagesRequests).toEqual([`/api/campaigns/${encodeURIComponent(target.id)}/images`]);
  });

  test('an invalid hash falls back to the first campaign and rewrites the hash', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length === 0, 'No campaigns configured');

    await page.goto('/#definitely-not-a-campaign');
    await waitForLoaderToFinish(page);
    await expectActiveCampaign(page, campaigns[0]);
  });
});

test.describe('Artists routes and browser history', () => {
  test('Artists toolbar button -> authors index -> artist detail -> back button', async ({ page }) => {
    await page.goto('/');
    await waitForLoaderToFinish(page);

    await page.getByRole('toolbar', { name: 'Primary actions' })
      .getByRole('button', { name: 'Artists', exact: true })
      .click();
    await expect(page).toHaveURL(/#authors$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Artists' })).toBeVisible();
    // Campaign switchers are hidden (visibility) on the authors index.
    await expect(page.getByTestId('current-campaign-top')).toBeHidden();

    const cards = page.locator('[data-testid="author-card"]:not(.author-card--unknown)');
    await expect
      .poll(async () => (await cards.count()) > 0 || (await page.locator('.authors-status').count()) > 0, { timeout: 15_000 })
      .toBe(true);
    test.skip((await cards.count()) === 0, 'No artists available (BLOB_READ_WRITE_TOKEN likely missing)');

    const firstCard = cards.first();
    const name = ((await firstCard.locator('.author-name').textContent()) || '').trim();
    await firstCard.locator('.author-card-button').click();

    await expect(page).toHaveURL(/#authors\/.+/);
    await expect(page.locator('.author-detail h1')).toHaveText(name);
    // The navbar switches to the artist switcher.
    await expect(page.getByTestId('current-artist-top')).toBeVisible();

    // In-app back button returns to the index.
    await page.getByRole('button', { name: 'Back to artists' }).click();
    await expect(page).toHaveURL(/#authors$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Artists' })).toBeVisible();

    // And the index back button returns to the gallery.
    await page.getByRole('button', { name: 'Back to gallery' }).click();
    await expect(page.locator('#campaign-info h1')).toBeVisible();
    await expect(page).not.toHaveURL(/#authors/);
  });

  test('browser back/forward moves between #authors and #authors/<handle>', async ({ page }) => {
    await page.goto('/#authors');
    await waitForLoaderToFinish(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Artists' })).toBeVisible();

    const cards = page.locator('[data-testid="author-card"]:not(.author-card--unknown)');
    await expect
      .poll(async () => (await cards.count()) > 0 || (await page.locator('.authors-status').count()) > 0, { timeout: 15_000 })
      .toBe(true);
    test.skip((await cards.count()) === 0, 'No artists available (BLOB_READ_WRITE_TOKEN likely missing)');

    const name = ((await cards.first().locator('.author-name').textContent()) || '').trim();
    await cards.first().locator('.author-card-button').click();
    await expect(page).toHaveURL(/#authors\/.+/);
    const detailUrl = page.url();
    await expect(page.locator('.author-detail h1')).toHaveText(name);

    await page.goBack();
    await expect(page).toHaveURL(/#authors$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Artists' })).toBeVisible();
    await expect(page.locator('.author-detail')).toHaveCount(0);

    await page.goForward();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.locator('.author-detail h1')).toHaveText(name);
  });

  test('artist prev/next switcher cycles artists and updates the hash', async ({ page, request }) => {
    const res = await request.get('/api/authors');
    const authors = ((await res.json()).authors ?? []) as Array<{ handle: string; name: string }>;
    test.skip(authors.length < 2, 'Need at least 2 artists');

    await page.goto(`/#authors/${encodeURIComponent(authors[0].handle)}`);
    await waitForLoaderToFinish(page);
    const title = page.getByTestId('current-artist-top');
    await expect(title).toHaveText(authors[0].name || authors[0].handle);

    await page.locator('#top-navbar').getByRole('button', { name: 'Next artist' }).click();
    await expect(title).toHaveText(authors[1].name || authors[1].handle);
    await expect(page).toHaveURL(new RegExp(`#authors/${escapeRegExp(encodeURIComponent(authors[1].handle))}$`));

    await page.locator('#bottom-navbar').getByRole('button', { name: 'Previous artist' }).click();
    await expect(title).toHaveText(authors[0].name || authors[0].handle);
  });
});
