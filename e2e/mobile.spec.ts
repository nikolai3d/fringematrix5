import { test, expect, devices, type Page } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';
import { fetchCampaigns } from './helpers/campaigns';

/**
 * Mobile viewport suite. Runs inside the chromium project with phone device
 * descriptors (viewport, DPR, isMobile, hasTouch, UA). `defaultBrowserType`
 * is stripped from the descriptor because test.use() cannot switch browsers
 * inside a project (it would force a new worker).
 */

function phone(name: 'iPhone 13' | 'Pixel 7') {
  const { defaultBrowserType: _ignored, ...descriptor } = devices[name];
  return descriptor;
}

const TOOLBAR_BUTTONS = [
  'Home', 'Campaigns', 'Share', 'Build Info', 'History', 'Credits', 'Artists', 'Legal', 'Settings',
];

// Minimum tap-target height. WCAG 2.5.8 (AA) requires 24px; Apple/Material
// recommend 44/48px. 32px is a pragmatic floor for this dense UI — see the
// report for controls that fall below the 44px recommendation.
// 44px: WCAG 2.5.5 / Apple HIG touch-target minimum, enforced for coarse
// pointers in styles.css (@media (pointer: coarse)).
const MIN_TAP_PX = 44;

async function gotoGallery(page: Page) {
  await page.goto('/');
  await waitForLoaderToFinish(page);
  await expect(page.locator('#campaign-info h1')).toBeVisible();
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.scrollingElement!.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

async function openFirstThumbnailByTap(page: Page): Promise<boolean> {
  const thumbs = page.locator('.gallery-grid .card img');
  if ((await thumbs.count()) === 0) return false;
  await thumbs.first().tap();
  await expect(page.locator('#lightbox')).toBeVisible();
  return true;
}

/** Dispatch a touch swipe (pointerdown -> pointerup) on #lightbox. */
async function swipe(page: Page, dx: number, dy = 0) {
  await page.evaluate(({ dx, dy }) => {
    const el = document.getElementById('lightbox')!;
    const startX = Math.round(window.innerWidth / 2);
    const startY = Math.round(window.innerHeight / 2);
    const common = { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...common, clientX: startX, clientY: startY }));
    el.dispatchEvent(new PointerEvent('pointerup', { ...common, clientX: startX + dx, clientY: startY + dy }));
  }, { dx, dy });
}

for (const deviceName of ['iPhone 13', 'Pixel 7'] as const) {
  test.describe(`Mobile layout — ${deviceName}`, () => {
    test.use(phone(deviceName));

    test('gallery renders with no horizontal page overflow', async ({ page }) => {
      await gotoGallery(page);
      const { scrollWidth, innerWidth } = await horizontalOverflow(page);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

      // Opening the lightbox must not introduce overflow either.
      if (await openFirstThumbnailByTap(page)) {
        const after = await horizontalOverflow(page);
        expect(after.scrollWidth).toBeLessThanOrEqual(after.innerWidth);
      }
    });
  });
}

test.describe('Mobile interactions — iPhone 13', () => {
  test.use(phone('iPhone 13'));

  test('toolbar scrolls horizontally and all 9 buttons are reachable and tappable', async ({ page }) => {
    await gotoGallery(page);
    const toolbar = page.getByRole('toolbar', { name: 'Primary actions' });
    const buttons = toolbar.getByRole('button');
    await expect(buttons).toHaveCount(TOOLBAR_BUTTONS.length);

    // The button row is wider than the phone, so its inner container must
    // scroll (rather than overflow the page or wrap off-screen).
    const scroll = await page.locator('.toolbar-inner').evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
    }));
    if (scroll.scrollWidth > scroll.clientWidth) {
      expect(['auto', 'scroll']).toContain(scroll.overflowX);
    }

    const innerWidth = await page.evaluate(() => window.innerWidth);
    for (const name of TOOLBAR_BUTTONS) {
      // Match on visible label: "Home" has aria-label "Go to home".
      const btn = toolbar.locator('.toolbar-button').filter({ hasText: new RegExp(`^${name}$`) });
      await expect(btn).toHaveCount(1);
      await btn.scrollIntoViewIfNeeded();
      const box = await btn.boundingBox();
      expect(box, `${name} has a layout box`).not.toBeNull();
      // 2px tolerance: scrollIntoView can land on a sub-pixel offset.
      expect(box!.x, `${name} left edge on-screen`).toBeGreaterThanOrEqual(-2);
      expect(box!.x + box!.width, `${name} right edge on-screen`).toBeLessThanOrEqual(innerWidth + 2);
      expect(box!.height, `${name} tap height`).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }

    // The last (initially off-screen) button actually works when tapped.
    await toolbar.getByRole('button', { name: 'Settings', exact: true }).tap();
    await expect(page.getByRole('dialog', { name: /settings/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /settings/i })).toBeHidden();
  });

  test('primary controls meet the minimum tap-target size', async ({ page }) => {
    await gotoGallery(page);

    const arrows = page.locator('#top-navbar .nav-arrow, #bottom-navbar .nav-arrow');
    await expect(arrows).toHaveCount(4);
    for (const box of await arrows.evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { label: e.getAttribute('aria-label'), w: r.width, h: r.height };
    }))) {
      expect(box.w, `${box.label} width`).toBeGreaterThanOrEqual(MIN_TAP_PX);
      // min-height on coarse pointers makes this independent of the ◀/▶
      // glyph metrics, which differ per platform font.
      expect(box.h, `${box.label} height`).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }

    if (!(await openFirstThumbnailByTap(page))) return;
    const controls = [
      page.locator('#lightbox-close'),
      page.locator('.lightbox-info-btn'),
      page.getByRole('button', { name: 'Previous image' }),
      page.getByRole('button', { name: 'Next image' }),
    ];
    for (const c of controls) {
      await expect(c).toBeVisible();
      const box = await c.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_PX);
      expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }
  });

  test('campaign sidebar opens on tap, fits on screen, and closes via the overlay', async ({ page, request }) => {
    const campaigns = await fetchCampaigns(request);
    test.skip(campaigns.length < 2, 'Need at least 2 campaigns');
    await gotoGallery(page);

    await page.getByRole('button', { name: 'Campaigns' }).tap();
    const sidebar = page.locator('#campaign-sidebar');
    await expect(sidebar).toHaveClass(/open/);
    await expect(sidebar).toHaveAttribute('aria-hidden', 'false');

    // The panel slides in (transform transition); wait for it to settle.
    await expect.poll(async () => (await sidebar.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
    const box = await sidebar.boundingBox();
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(box!.x + box!.width).toBeLessThanOrEqual(innerWidth);
    // Leaves a strip of overlay visible to tap for dismissal.
    expect(box!.x + box!.width).toBeLessThan(innerWidth);

    // Tap the overlay to the right of the sidebar panel.
    const overlay = page.locator('.sidebar-overlay');
    await expect(overlay).toBeVisible();
    const viewport = page.viewportSize()!;
    await page.touchscreen.tap(viewport.width - 10, Math.round(viewport.height / 2));
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(overlay).toHaveCount(0);

    // The explicit close button (44px on touch) also closes it.
    await page.getByRole('button', { name: 'Campaigns' }).tap();
    await expect(sidebar).toHaveClass(/open/);
    const close = sidebar.getByRole('button', { name: 'Close campaigns' });
    const closeBox = await close.boundingBox();
    expect(closeBox!.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(closeBox!.height).toBeGreaterThanOrEqual(MIN_TAP_PX);
    await close.tap();
    await expect(sidebar).not.toHaveClass(/open/);

    // Selecting a campaign from the sidebar closes it and switches campaign.
    await page.getByRole('button', { name: 'Campaigns' }).tap();
    await expect(sidebar).toHaveClass(/open/);
    await sidebar.getByRole('button', { name: `#${campaigns[1].hashtag}`, exact: true }).tap();
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(page.getByTestId('current-campaign-top')).toHaveText(`#${campaigns[1].hashtag}`);
  });

  test('tapping a thumbnail opens the lightbox; swiping navigates between images', async ({ page }) => {
    await gotoGallery(page);
    const thumbCount = await page.locator('.gallery-grid .card img').count();
    test.skip(thumbCount < 2, 'Need at least 2 images');
    await openFirstThumbnailByTap(page);

    const img = page.locator('#lightbox-image');
    const hud = page.locator('.lightbox-hud');
    await expect(hud).toContainText(/\b1 OF \d+/);
    const firstSrc = await img.getAttribute('src');
    expect(firstSrc).toBeTruthy();

    // Swipe left (finger moves right-to-left) -> next image.
    await swipe(page, -120, 10);
    await expect(hud).toContainText(/\b2 OF \d+/);
    await expect.poll(() => img.getAttribute('src')).not.toBe(firstSrc);

    // Swipe right -> back to the first image.
    await swipe(page, 120, -10);
    await expect(hud).toContainText(/\b1 OF \d+/);
    await expect.poll(() => img.getAttribute('src')).toBe(firstSrc);

    // A mostly-vertical gesture is a scroll, not a swipe: no navigation.
    await swipe(page, -60, 120);
    // A short horizontal jitter is below the swipe threshold.
    await swipe(page, -30, 0);
    await page.waitForTimeout(150);
    await expect(hud).toContainText(/\b1 OF \d+/);
    expect(await img.getAttribute('src')).toBe(firstSrc);

    // Swipes must not dismiss the lightbox.
    await expect(page.locator('#lightbox')).toBeVisible();
  });

  test('lightbox details drawer opens via the info button and fits the viewport', async ({ page }) => {
    await gotoGallery(page);
    test.skip(!(await openFirstThumbnailByTap(page)), 'No images available');

    // On phones the inline sidebar is hidden in favour of the drawer.
    await expect(page.locator('.lightbox-details').first()).toBeHidden();
    const info = page.getByRole('button', { name: 'Show image details' });
    await info.tap();

    const drawer = page.locator('.lightbox-details-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('IMAGE DETAILS')).toBeVisible();
    const vp = page.viewportSize()!;
    // The drawer slides up from the bottom edge; wait for it to settle.
    await expect
      .poll(async () => {
        const b = await drawer.boundingBox();
        return b ? b.y + b.height : Infinity;
      })
      .toBeLessThanOrEqual(vp.height + 1);
    const box = await drawer.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

    await page.getByRole('button', { name: 'Close image details' }).tap();
    await expect(drawer).toBeHidden();
    await expect(page.locator('#lightbox')).toBeVisible();

    await page.locator('#lightbox-close').tap();
    await expect(page.locator('#lightbox')).toBeHidden();
  });

  test('content modal fits within the viewport and its body scrolls', async ({ page }) => {
    await gotoGallery(page);
    const toolbar = page.getByRole('toolbar', { name: 'Primary actions' });
    const history = toolbar.getByRole('button', { name: 'History', exact: true });
    await history.scrollIntoViewIfNeeded();
    await history.tap();

    const modal = page.locator('.content-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.content-modal-loading')).toHaveCount(0);

    const box = await modal.boundingBox();
    const vp = page.viewportSize()!;
    // Centred with equal side margins (it used to overflow to the right:
    // 95vw was wider than the overlay's padded box).
    expect(Math.abs(box!.x - (vp.width - (box!.x + box!.width)))).toBeLessThanOrEqual(1);
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

    // Long content scrolls inside the body instead of overflowing the page.
    const bodyScroll = await modal.locator('.content-modal-body').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    if (bodyScroll.scrollHeight > bodyScroll.clientHeight) {
      expect(['auto', 'scroll']).toContain(bodyScroll.overflowY);
    }

    // The close button is on-screen and dismisses the modal.
    const close = modal.getByRole('button', { name: 'Close' });
    const closeBox = await close.boundingBox();
    expect(closeBox!.x + closeBox!.width).toBeLessThanOrEqual(vp.width);
    await close.tap();
    await expect(modal).toBeHidden();
  });
});
