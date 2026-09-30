import { test, expect, type APIRequestContext } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';
import { ZORT_HASH, ZORT_HANDLE } from './helpers/author-browse';

/**
 * fringematrix5-nzp2.1 / .2 / .3:
 *  - ?img= share links reopen the shared image in the lightbox.
 *  - The lightbox warms the next image before the user pages to it.
 *  - Author pages load thumbnails straight from the Blob CDN, never through
 *    the per-image /avatars redirect.
 */

interface ApiImage { id: string | null; src: string; fileName: string }

async function firstCampaignWithImages(request: APIRequestContext, min: number) {
  const { campaigns } = await (await request.get('/api/campaigns')).json();
  for (const c of campaigns as Array<{ id: string }>) {
    const res = await request.get(`/api/campaigns/${c.id}/images`);
    if (!res.ok()) continue;
    const { images } = await res.json() as { images: ApiImage[] };
    if (images.length >= min) return { campaignId: c.id, images };
  }
  return null;
}

test.describe('Shared-image links (?img=)', () => {
  test('opening a share link shows that image in the lightbox and cleans the URL', async ({ page, request }) => {
    const found = await firstCampaignWithImages(request, 3);
    if (!found) test.skip(true, 'No campaign with >= 3 images');
    const { campaignId, images } = found!;
    const index = Math.min(images.length - 1, 20);
    const target = images[index]!;
    const value = target.id ?? target.src;

    await page.goto(`/?img=${encodeURIComponent(value)}#${campaignId}`);
    await waitForLoaderToFinish(page);

    const lightbox = page.locator('#lightbox');
    await expect(lightbox).toBeVisible();
    await expect(page.locator('#lightbox-image')).toHaveAttribute('src', target.src);
    await expect(page.locator('.lightbox-hud')).toContainText(`${index + 1} OF ${images.length}`);

    // Param consumed; campaign hash kept.
    expect(new URL(page.url()).searchParams.get('img')).toBeNull();
    expect(new URL(page.url()).hash).toBe(`#${campaignId}`);

    // Closing leaves the user on the campaign grid.
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    await expect(page.locator('.gallery-grid .card').first()).toBeVisible();
  });

  test('an unknown image id just shows the campaign', async ({ page, request }) => {
    const found = await firstCampaignWithImages(request, 1);
    if (!found) test.skip(true, 'No campaign with images');
    await page.goto(`/?img=does-not-exist#${found!.campaignId}`);
    await waitForLoaderToFinish(page);
    await expect(page.locator('.gallery-grid .card').first()).toBeVisible();
    await expect(page.locator('#lightbox')).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get('img')).toBeNull();
  });
});

test.describe('Lightbox neighbor preloading', () => {
  test('the next full-resolution image is requested before NEXT is pressed', async ({ page, request }) => {
    const found = await firstCampaignWithImages(request, 3);
    if (!found) test.skip(true, 'No campaign with >= 3 images');
    const { campaignId, images } = found!;

    const requested = new Set<string>();
    page.on('request', (r) => requested.add(r.url()));

    await page.goto(`/#${campaignId}`);
    await waitForLoaderToFinish(page);
    await page.locator('.gallery-grid .card img').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();

    // Original (non-optimized) URLs of the neighbors: index 1 and the last one.
    await expect.poll(() => requested.has(images[1]!.src), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => requested.has(images[images.length - 1]!.src), { timeout: 15_000 }).toBe(true);
  });
});

test.describe('Author pages use direct CDN image URLs', () => {
  test('author thumbnails never go through the /avatars redirect', async ({ page, request }) => {
    const detail = await request.get(`/api/authors/${encodeURIComponent(ZORT_HANDLE)}`);
    const body = await detail.json();
    if (!body.images?.length) test.skip(true, 'No attributed images (no Blob token)');
    if (String(body.images[0].src).startsWith('/avatars/')) {
      test.skip(true, 'Server has no Blob token, so it falls back to /avatars redirects');
    }

    // Same-origin /avatars/* requests are the redirect route; the CDN URLs
    // themselves also have an /avatars/ path, so filter by origin.
    const appOrigin = new URL(detail.url()).origin;
    const avatarRequests: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.origin === appOrigin && u.pathname.startsWith('/avatars/')) avatarRequests.push(r.url());
    });

    await page.goto(`/${ZORT_HASH}`);
    await waitForLoaderToFinish(page);
    const thumbs = page.locator('[data-testid="author-images-grid"] .card img');
    await expect(thumbs.first()).toBeVisible();
    // Let the visible thumbnails start loading.
    await expect.poll(async () => thumbs.first().evaluate((el) => (el as HTMLImageElement).complete)).toBe(true);

    const src = await thumbs.first().getAttribute('src');
    expect(src).toMatch(/^(https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/avatars\/|\/_vercel\/image\?)/);
    expect(avatarRequests).toEqual([]);
  });
});
