import { test, expect, Page } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';

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

async function gotoCampaign(page: Page, campaignId: string) {
  await page.goto(`/#${campaignId}`);
  await waitForLoaderToFinish(page);
}

/**
 * Result of an attempted lightbox open:
 *   - 'opened'      : the requested fileName was found and clicked.
 *   - 'empty'       : the gallery returned no images at all (caller should
 *                     skip — typically a no-token test environment).
 *   - 'missing'     : the gallery had images but none matched fileName
 *                     (caller should fail loudly — a real regression or
 *                     fixture drift, not an environment issue).
 */
type OpenResult =
  | { status: 'opened' }
  | { status: 'empty' }
  | { status: 'missing'; available: string[] };

/**
 * Click the gallery card whose `alt` exactly matches `fileName` (the client
 * sets `alt={image.fileName}` in ImageCard).
 *
 * We deliberately distinguish "no images at all" (skip) from "the specific
 * fixture file is gone" (hard fail) so that fixture drift on the live blob
 * store can never silently turn this spec into a no-op.
 */
async function openLightboxForFile(page: Page, fileName: string): Promise<OpenResult> {
  const cards = page.locator('.gallery-grid .card img');
  if ((await cards.count()) === 0) return { status: 'empty' };

  const target = page.locator(`.gallery-grid .card img[alt="${fileName}"]`);
  // The gallery grid is virtualized — only the cards in/near the viewport are
  // mounted, so a target lower in the list may not be in the DOM yet. Scroll
  // the page down in viewport-sized steps until the target card mounts or we
  // reach the bottom, then proceed with the usual missing/opened logic.
  if ((await target.count()) === 0) {
    let lastScrollY = -1;
    for (let i = 0; i < 60; i++) {
      if ((await target.count()) > 0) break;
      const atBottom = await page.evaluate(() => {
        const prev = window.scrollY;
        window.scrollBy(0, Math.round(window.innerHeight * 0.8));
        return { prev, next: window.scrollY };
      });
      // Give the windowing recompute (rAF) a frame to mount the new rows.
      await page.waitForTimeout(120);
      if (atBottom.next === lastScrollY) break; // scroll didn't move — bottom reached
      lastScrollY = atBottom.next;
    }
  }
  if ((await target.count()) === 0) {
    // Capture a sample of available alt values so the failure message points
    // straight at the likely culprit (file renamed, moved, removed).
    const available = await cards.evaluateAll((els: Element[]) =>
      els.slice(0, 10).map((el) => (el as HTMLImageElement).alt)
    );
    return { status: 'missing', available };
  }

  await target.first().click();
  await expect(page.locator('#lightbox')).toBeVisible();
  // Make sure the lightbox is showing the intended image — fileName appears
  // in the HUD line ("FILE: <name> // <i> OF <n>").
  await expect(page.locator('.lightbox-hud')).toContainText(fileName);
  return { status: 'opened' };
}

test.describe('Lightbox AUTHOR row — resolved (high confidence)', () => {
  test('renders avatar initials and a Twitter link for a known @Zort70 image', async ({ page }) => {
    await gotoCampaign(page, 'beabetterman');

    const result = await openLightboxForFile(page, 'beabettermanBrown.jpg');
    if (result.status === 'empty') {
      test.skip(true, 'No images available in this environment (BLOB_READ_WRITE_TOKEN likely missing).');
    }
    if (result.status === 'missing') {
      throw new Error(
        `Fixture 'beabettermanBrown.jpg' not found in BeABetterMan campaign. ` +
        `Available alts (up to 10): ${JSON.stringify(result.available)}. ` +
        `If the blob storage layout changed, pick another @Zort70 image and update this spec.`
      );
    }

    // Scope assertions to the inline sidebar so we hit a single instance even
    // when the mobile drawer's hidden copy is also in the DOM.
    const sidebar = page.locator('.lightbox-details').first();
    await expect(sidebar).toBeVisible();

    // AUTHOR row should be present.
    const authorRow = sidebar.locator('.lightbox-details-author');
    await expect(authorRow).toBeVisible();
    await expect(authorRow.getByText('ARTIST', { exact: true })).toBeVisible();

    // Avatar element with initials derived from '@Zort70' → 'ZO' (one
    // uppercase letter in the handle, so getInitials() falls through to the
    // first-two-chars rule, yielding 'ZO').
    const avatar = authorRow.locator('.lightbox-author-avatar');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveText('ZO');

    // Handle rendered as an in-app navigation button (fringematrix5-4a6o).
    // The handle text itself is now a <button> that opens the author gallery;
    // the external Twitter link lives beside it as an icon-only <a>.
    const handleButton = authorRow.getByRole('button', { name: /Zort70/ });
    await expect(handleButton).toBeVisible();
    await expect(handleButton).toContainText('@Zort70');

    const twitterLink = authorRow.getByRole('link', { name: /Zort70/ });
    await expect(twitterLink).toBeVisible();
    await expect(twitterLink).toHaveAttribute('href', 'https://twitter.com/Zort70');
    await expect(twitterLink).toHaveAttribute('target', '_blank');
    await expect(twitterLink).toHaveAttribute('rel', /noopener/);

    // High-confidence images do NOT get the 'uncertain' badge.
    await expect(authorRow.locator('.lightbox-author-badge')).toHaveCount(0);
  });
});

test.describe('Lightbox AUTHOR row — unresolved (unknown artist)', () => {
  // fringematrix5-0y9l: the lightbox no longer surfaces the "Possibly: @A,
  // @B" candidate list for unresolved images. Both unresolved sub-cases
  // ("no handle + candidates" and "no handle + no candidates") now collapse
  // into a single "unknown" affordance that links to the synthetic Unknown
  // artist gallery (`#authors/__unknown__`).
  test('shows the "unknown artist" link for an unresolved ObserveItLive image', async ({ page }) => {
    await gotoCampaign(page, 'observeitlive');

    // Any image inside the fully-unresolved `oil/` folder works; pick the
    // first one alphabetically that we know lives there.
    const result = await openLightboxForFile(page, 'OIL_blue.jpg');
    if (result.status === 'empty') {
      test.skip(true, 'No images available in this environment (BLOB_READ_WRITE_TOKEN likely missing).');
    }
    if (result.status === 'missing') {
      throw new Error(
        `Fixture 'OIL_blue.jpg' not found in ObserveItLive campaign. ` +
        `Available alts (up to 10): ${JSON.stringify(result.available)}. ` +
        `If the blob storage layout changed, pick another image from the unresolved oil/ folder and update this spec.`
      );
    }

    const sidebar = page.locator('.lightbox-details').first();
    const authorRow = sidebar.locator('.lightbox-details-author');
    await expect(authorRow).toBeVisible();
    await expect(authorRow.getByText('ARTIST', { exact: true })).toBeVisible();

    // Unresolved avatar still shows a literal '?'.
    const avatar = authorRow.locator('.lightbox-author-avatar--unresolved');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveText('?');

    // The "unknown" affordance is rendered as a button (in-app navigation
    // to the Unknown artist gallery is available in the running app).
    const unknownBtn = authorRow.getByRole('button', { name: /view all images by unknown artist/i });
    await expect(unknownBtn).toBeVisible();
    await expect(unknownBtn).toContainText(/unknown artist/i);

    // Candidate list is gone — no "Possibly:" label, no candidate handles.
    await expect(authorRow.locator('.lightbox-author-candidates')).toHaveCount(0);
    await expect(authorRow).not.toContainText('Possibly:');
    await expect(authorRow).not.toContainText('@Cheribot');
    await expect(authorRow).not.toContainText('@SarahProost');
    await expect(authorRow).not.toContainText('@Zort70');

    // Clicking the "unknown" button navigates to the synthetic Unknown
    // artist detail page.
    await unknownBtn.click();
    await page.waitForFunction(() => window.location.hash.includes('authors/__unknown__'));
    expect(page.url()).toContain('authors/__unknown__');
  });
});
