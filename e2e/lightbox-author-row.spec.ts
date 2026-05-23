import { test, expect, Page } from '@playwright/test';

/**
 * E2E coverage for the lightbox AUTHOR row introduced in fringematrix5-5s8.
 *
 * Two real-data flows are exercised against the live backend:
 *   1. A high-confidence resolved attribution (BeABetterMan → @Zort70 via the
 *      `BABM-zort70/` named-artist folder).
 *   2. An unresolved attribution with multiple candidates (ObserveItLive →
 *      `oil/` folder, three campaign candidates).
 *
 * Both flows depend on the Vercel Blob store being reachable. When the test
 * environment has no `BLOB_READ_WRITE_TOKEN` the gallery comes back empty;
 * we follow the existing spec convention and `test.skip` with a reason
 * rather than failing.
 */

async function waitForLoaderToFinish(page: Page) {
  const loader = page.getByRole('dialog', { name: 'Loading' });
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'detached' });
  }
}

async function gotoCampaign(page: Page, campaignId: string) {
  await page.goto(`/#${campaignId}`);
  await waitForLoaderToFinish(page);
}

/**
 * Click the gallery card whose `alt` exactly matches `fileName` (the client
 * sets `alt={image.fileName}` in ImageCard). Returns false when no such card
 * is visible — typically because the live backend returned an empty image
 * list, in which case the caller should skip.
 */
async function openLightboxForFile(page: Page, fileName: string): Promise<boolean> {
  const cards = page.locator('.gallery-grid .card img');
  if ((await cards.count()) === 0) return false;
  const target = page.locator(`.gallery-grid .card img[alt="${fileName}"]`);
  if ((await target.count()) === 0) return false;
  await target.first().click();
  await expect(page.locator('#lightbox')).toBeVisible();
  // Make sure the lightbox is showing the intended image — fileName appears
  // in the HUD line ("FILE: <name> // <i> OF <n>").
  await expect(page.locator('.lightbox-hud')).toContainText(fileName);
  return true;
}

test.describe('Lightbox AUTHOR row — resolved (high confidence)', () => {
  test('renders avatar initials and a Twitter link for a known @Zort70 image', async ({ page }) => {
    await gotoCampaign(page, 'beabetterman');

    const opened = await openLightboxForFile(page, 'beabettermanBrown.jpg');
    if (!opened) {
      test.skip(true, 'No images available in this environment (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    // Scope assertions to the inline sidebar so we hit a single instance even
    // when the mobile drawer's hidden copy is also in the DOM.
    const sidebar = page.locator('.lightbox-details').first();
    await expect(sidebar).toBeVisible();

    // AUTHOR row should be present.
    const authorRow = sidebar.locator('.lightbox-details-author');
    await expect(authorRow).toBeVisible();
    await expect(authorRow.getByText('AUTHOR', { exact: true })).toBeVisible();

    // Avatar element with initials derived from '@Zort70' → 'ZO' (one
    // uppercase letter in the handle, so getInitials() falls through to the
    // first-two-chars rule, yielding 'ZO').
    const avatar = authorRow.locator('.lightbox-author-avatar');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveText('ZO');

    // Handle rendered as a link pointing at the canonical Twitter URL.
    const handleLink = authorRow.getByRole('link', { name: /Zort70/ });
    await expect(handleLink).toBeVisible();
    await expect(handleLink).toContainText('@Zort70');
    await expect(handleLink).toHaveAttribute('href', 'https://twitter.com/Zort70');
    await expect(handleLink).toHaveAttribute('target', '_blank');
    await expect(handleLink).toHaveAttribute('rel', /noopener/);

    // High-confidence images do NOT get the 'uncertain' badge.
    await expect(authorRow.locator('.lightbox-author-badge')).toHaveCount(0);
  });
});

test.describe('Lightbox AUTHOR row — unresolved with candidates', () => {
  test('shows "Possibly: …" candidate list for an unresolved ObserveItLive image', async ({ page }) => {
    await gotoCampaign(page, 'observeitlive');

    // Any image inside the fully-unresolved `oil/` folder works; pick the
    // first one alphabetically that we know lives there.
    const opened = await openLightboxForFile(page, 'OIL_blue.jpg');
    if (!opened) {
      test.skip(true, 'No images available in this environment (BLOB_READ_WRITE_TOKEN likely missing).');
    }

    const sidebar = page.locator('.lightbox-details').first();
    const authorRow = sidebar.locator('.lightbox-details-author');
    await expect(authorRow).toBeVisible();
    await expect(authorRow.getByText('AUTHOR', { exact: true })).toBeVisible();

    // Unresolved avatar shows a literal '?'.
    const avatar = authorRow.locator('.lightbox-author-avatar--unresolved');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveText('?');

    // "Possibly:" label + each expected candidate handle.
    const candidates = authorRow.locator('.lightbox-author-candidates');
    await expect(candidates).toBeVisible();
    await expect(candidates).toContainText('Possibly:');
    await expect(candidates).toContainText('@Cheribot');
    await expect(candidates).toContainText('@SarahProost');
    await expect(candidates).toContainText('@Zort70');

    // Unresolved state must NOT render an attribution link.
    await expect(authorRow.locator('a')).toHaveCount(0);
  });
});
