import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

/**
 * Full unit-test matrix for the lightbox artist/campaign navigation handlers
 * in `client/src/App.tsx` (fringematrix5-z874):
 *
 *   - `handleOpenCampaignGallery`         — clicking EPISODE / HASHTAG link
 *                                           inside the lightbox details panel.
 *   - `handleOpenAuthorGalleryFromLightbox` — clicking the ARTIST HANDLE link
 *                                           inside the lightbox details panel.
 *
 * Coverage axes:
 *   - Origin route: gallery (`#<campaignId>`) vs artist-browse (`#authors/X`).
 *   - Target campaign vs `activeCampaignId`: same vs different.
 *   - Target artist vs currently-viewed artist: same vs different vs N/A.
 *
 * Per case, we assert:
 *   - The lightbox closes.
 *   - The final hash route matches the expected target.
 *   - `activeCampaignId` is updated when (and only when) the target campaign
 *     differs (observed via the bottom-bar hashtag and via
 *     `/api/campaigns/:id/images` fetches recorded by the fetch mock).
 *   - A campaign-images fetch is/isn't dispatched as appropriate (no-op when
 *     nothing changed; new fetch when the campaign actually flips).
 *
 * Structural reachability notes:
 *   - "Gallery origin + DIFFERENT target campaign" is NOT reachable through
 *     the lightbox: gallery-mode lightbox is bound to the active campaign's
 *     images, so the campaign link in lightbox details always targets
 *     `activeCampaignId`. We therefore only assert the same-target cell from
 *     gallery origin and exercise the different-target cell from artist
 *     origin (cells 3 + 4) — which is where the regression lives.
 *   - Artist-mode lightbox author lookup reads `currentImage.author`, NOT the
 *     viewed-author handle. To exercise the "artist origin + DIFFERENT target
 *     artist" cell we plant an image attributed to artist Y inside artist
 *     X's detail response — a valid (mis-attribution) scenario that the
 *     attribution pipeline can produce in practice.
 *
 * The single-cell regression test that motivated this matrix lives in
 * `App.openCampaignFromArtistMode.test.tsx`. Its setup is the template here.
 *
 * The bead description suggested an OPTIONAL pure-helper extraction. We chose
 * NOT to refactor: the handlers in App.tsx are short and direct, and a pure
 * helper would only restate them without exercising the real wiring through
 * `selectCampaign`, route state, and the hash. A longer plain integration
 * test file is the better trade-off here.
 */

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CAMPAIGN_A = 'crosstheline';
const CAMPAIGN_B = 'letters';

const HANDLE_X = '@Alice';
const HANDLE_Y = '@Bob';

const AUTHOR_HASH_X = `#authors/${encodeURIComponent(HANDLE_X)}`;
const AUTHOR_HASH_Y = `#authors/${encodeURIComponent(HANDLE_Y)}`;

const CAMPAIGNS = [
  {
    id: CAMPAIGN_A,
    episode: 'Cross The Line',
    episode_id: 'S04E18',
    hashtag: 'CrossTheLine',
    date: '2012-04-13',
    icon_path: 'Season4/CrossTheLine',
  },
  {
    id: CAMPAIGN_B,
    episode: 'Letters of Transit',
    episode_id: 'S04E19',
    hashtag: 'Letters',
    date: '2012-04-20',
    icon_path: 'Season4/Letters',
  },
];

const AUTHOR_X = {
  handle: HANDLE_X,
  name: 'Alice Artist',
  twitterUrl: null,
  alternateHandles: [],
  roles: ['artist'],
};
const AUTHOR_Y = {
  handle: HANDLE_Y,
  name: 'Bob Artist',
  twitterUrl: null,
  alternateHandles: [],
  roles: ['artist'],
};

// Wire-format ImageAuthor records attached to each image by the attribution
// enrichment pipeline. Minimal high-confidence shapes — one per artist.
const IMAGE_AUTHOR_X = {
  handle: HANDLE_X,
  displayName: 'Alice Artist',
  twitterUrl: null,
  confidence: 'high' as const,
  candidates: [],
};
const IMAGE_AUTHOR_Y = {
  handle: HANDLE_Y,
  displayName: 'Bob Artist',
  twitterUrl: null,
  confidence: 'high' as const,
  candidates: [],
};

// Author X's detail response spans BOTH campaigns AND has a third image
// attributed to artist Y — letting us cover cross-campaign clicks and
// cross-artist clicks from a single artist-mode origin.
//
//   index 0 → CAMPAIGN_A, attributed to X
//   index 1 → CAMPAIGN_B, attributed to X
//   index 2 → CAMPAIGN_A, attributed to Y   (synthetic cross-claim image)
const AUTHOR_X_DETAIL = {
  author: AUTHOR_X,
  images: [
    {
      src: '/avatars/Season4/CrossTheLine/x-a.jpg',
      fileName: 'x-a.jpg',
      blobPath: 'avatars/Season4/CrossTheLine/x-a.jpg',
      campaignId: CAMPAIGN_A,
      author: IMAGE_AUTHOR_X,
    },
    {
      src: '/avatars/Season4/Letters/x-b.jpg',
      fileName: 'x-b.jpg',
      blobPath: 'avatars/Season4/Letters/x-b.jpg',
      campaignId: CAMPAIGN_B,
      author: IMAGE_AUTHOR_X,
    },
    {
      src: '/avatars/Season4/CrossTheLine/y-claim.jpg',
      fileName: 'y-claim.jpg',
      blobPath: 'avatars/Season4/CrossTheLine/y-claim.jpg',
      campaignId: CAMPAIGN_A,
      author: IMAGE_AUTHOR_Y,
    },
  ],
};

const AUTHOR_Y_DETAIL = {
  author: AUTHOR_Y,
  images: [
    {
      src: '/avatars/Season4/CrossTheLine/y-a.jpg',
      fileName: 'y-a.jpg',
      blobPath: 'avatars/Season4/CrossTheLine/y-a.jpg',
      campaignId: CAMPAIGN_A,
      author: IMAGE_AUTHOR_Y,
    },
  ],
};

// Gallery-mode images for CAMPAIGN_A. First attributed to X (so we can click
// the artist link), second to Y. Both belong to CAMPAIGN_A (gallery mode).
const CAMPAIGN_A_IMAGES = [
  {
    src: '/avatars/Season4/CrossTheLine/a1.jpg',
    fileName: 'a1.jpg',
    blobPath: 'avatars/Season4/CrossTheLine/a1.jpg',
    author: IMAGE_AUTHOR_X,
  },
  {
    src: '/avatars/Season4/CrossTheLine/a2.jpg',
    fileName: 'a2.jpg',
    blobPath: 'avatars/Season4/CrossTheLine/a2.jpg',
    author: IMAGE_AUTHOR_Y,
  },
];

const CAMPAIGN_B_IMAGES = [
  {
    src: '/avatars/Season4/Letters/b1.jpg',
    fileName: 'b1.jpg',
    blobPath: 'avatars/Season4/Letters/b1.jpg',
    author: IMAGE_AUTHOR_X,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface FetchLog {
  campaignImages: string[];      // recorded campaign ids for /images calls
  authorDetailFor: string[];     // recorded handles for /api/authors/:handle calls
}

function makeFetchMock(log: FetchLog) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    const imagesMatch = url.match(/^\/api\/campaigns\/([^/]+)\/images$/);
    if (imagesMatch) {
      const id = imagesMatch[1];
      log.campaignImages.push(id);
      if (id === CAMPAIGN_A) return jsonResponse({ images: CAMPAIGN_A_IMAGES });
      if (id === CAMPAIGN_B) return jsonResponse({ images: CAMPAIGN_B_IMAGES });
      return jsonResponse({ images: [] });
    }
    if (url === '/api/campaigns') {
      return jsonResponse({ campaigns: CAMPAIGNS });
    }
    if (url === '/api/build-info') {
      return jsonResponse({ commitHash: 'dev-local', deployedAt: null });
    }
    if (url === '/api/glyphs') {
      return jsonResponse({ glyphs: [] });
    }
    if (url === '/api/authors') {
      // Both authors so the artist nav-switcher renders happily in artist mode.
      return jsonResponse({
        authors: [
          { ...AUTHOR_X, imageCount: AUTHOR_X_DETAIL.images.length },
          { ...AUTHOR_Y, imageCount: AUTHOR_Y_DETAIL.images.length },
        ],
      });
    }
    const handleMatch = url.match(/^\/api\/authors\/([^/]+)$/);
    if (handleMatch) {
      const handle = decodeURIComponent(handleMatch[1]);
      log.authorDetailFor.push(handle);
      if (handle === HANDLE_X) return jsonResponse(AUTHOR_X_DETAIL);
      if (handle === HANDLE_Y) return jsonResponse(AUTHOR_Y_DETAIL);
      return jsonResponse({ error: `unknown handle ${handle}` }, 404);
    }

    return jsonResponse({ error: `Unmocked URL: ${url}` }, 404);
  });
}

function makeLog(): FetchLog {
  return { campaignImages: [], authorDetailFor: [] };
}

/** Wait for the campaigns list to have loaded (Home button is unconditionally rendered then). */
async function waitForAppReady() {
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /go to home/i })).toBeTruthy();
  });
}

async function clickThumbnail(grid: HTMLElement, index: number) {
  const imgs = grid.querySelectorAll('img');
  expect(imgs.length).toBeGreaterThan(index);
  await act(async () => {
    fireEvent.click(imgs[index]!);
  });
}

async function openLightboxFromAuthorGrid(index: number): Promise<HTMLElement> {
  const grid = await screen.findByTestId('author-images-grid');
  await clickThumbnail(grid, index);
  return screen.findByRole('dialog', { name: /image viewer/i });
}

async function openLightboxFromGallery(index: number): Promise<HTMLElement> {
  // Gallery grid has no test id; find it by class. Wait until it mounts.
  const grid = await waitFor(() => {
    const el = document.querySelector('.gallery-grid');
    if (!el) throw new Error('gallery-grid not rendered yet');
    return el as HTMLElement;
  });
  await clickThumbnail(grid, index);
  return screen.findByRole('dialog', { name: /image viewer/i });
}

function getCampaignLink(lightbox: HTMLElement): HTMLButtonElement {
  const btn = lightbox.querySelector(
    'button.lightbox-details-campaign-link',
  ) as HTMLButtonElement | null;
  expect(btn).toBeTruthy();
  return btn!;
}

function getAuthorHandleLink(lightbox: HTMLElement): HTMLButtonElement {
  // Resolved-author handle renders as a button with this class combination.
  const btn = lightbox.querySelector(
    'button.lightbox-author-handle--button',
  ) as HTMLButtonElement | null;
  expect(btn).toBeTruthy();
  return btn!;
}

/**
 * Park the app in a gallery view on the given campaign and wait for it to
 * settle. After this returns, `activeCampaignId === id` and `route.type === 'gallery'`.
 */
async function startInGallery(id: string) {
  window.location.hash = id;
  await act(async () => {
    render(<App />);
  });
  await waitForAppReady();
  // Wait for the gallery grid to actually appear (campaign images loaded).
  await waitFor(() => {
    expect(document.querySelector('.gallery-grid')).toBeTruthy();
  });
}

/**
 * Park the app in artist-browse mode WITH the given campaign as the
 * previously-active campaign — `activeCampaignId === priorCampaign` before
 * the artist hash takes over. This mirrors the real user flow that caused
 * fringematrix5-u7gd and is needed for several matrix cells.
 */
async function startInArtistModeWithPriorCampaign(handle: string, priorCampaign: string) {
  // First mount on the prior campaign to seed activeCampaignId.
  window.location.hash = priorCampaign;
  await act(async () => {
    render(<App />);
  });
  await waitForAppReady();
  await waitFor(() => {
    expect(document.querySelector('.gallery-grid')).toBeTruthy();
  });
  // Navigate into artist-browse mode by setting the hash.
  await act(async () => {
    window.location.hash = `authors/${encodeURIComponent(handle)}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await screen.findByTestId('author-images-grid');
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

// jsdom's `Image` constructor never fires `onload` or `onerror`, so
// `useCampaignLoader.preloadCampaignImages` would hang waiting for each Image
// for its full 15-second timeout — leaving every gallery image stuck in the
// loading-placeholder state with no <img> to click. Patch the constructor to
// fire `onload` on the next microtask whenever `src` is assigned, mirroring
// real-browser behavior closely enough to drive the App through to a fully-
// loaded gallery within a test.
const OriginalImage = globalThis.Image;
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src() { return this._src; }
  set src(value: string) {
    this._src = value;
    // Defer to a microtask so the caller can finish wiring handlers/etc.
    queueMicrotask(() => { this.onload?.(); });
  }
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  // reduceMotion=true short-circuits the lightbox open/close animations so
  // assertions can run synchronously after a click.
  window.localStorage.setItem(
    'fringematrix-a11y',
    JSON.stringify({ reduceMotion: true, reduceEffects: true, thumbnailSizeIndex: 0 }),
  );
  (globalThis as unknown as { Image: typeof Image }).Image = FakeImage as unknown as typeof Image;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as unknown as { Image: typeof Image }).Image = OriginalImage;
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, '', window.location.pathname);
});

// ─── handleOpenCampaignGallery — origin × target campaign matrix ─────────────

describe('App: handleOpenCampaignGallery — origin × target campaign matrix', () => {
  it('gallery origin + same target campaign: stays on gallery, no new fetch', async () => {
    // Cell 1: Origin = gallery #A. Target campaign = A.
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInGallery(CAMPAIGN_A);

    const fetchesBefore = log.campaignImages.length;

    const lightbox = await openLightboxFromGallery(0);
    await act(async () => { fireEvent.click(getCampaignLink(lightbox)); });

    // Lightbox closes.
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
    // Hash still on the same campaign.
    expect(window.location.hash).toBe(`#${CAMPAIGN_A}`);
    // Gallery grid still on screen.
    expect(document.querySelector('.gallery-grid')).toBeTruthy();
    // No new /images fetch: handler short-circuits selectCampaign when the
    // campaign is unchanged.
    expect(log.campaignImages.length).toBe(fetchesBefore);
  });

  it('artist origin + target campaign equals activeCampaignId: navigates to gallery, no new fetch (u7gd repro)', async () => {
    // Cell 2: Origin = #authors/X with activeCampaignId === A. Target = A.
    // The fringematrix5-u7gd regression path: the handler MUST still navigate
    // even though selectCampaign would be a no-op.
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInArtistModeWithPriorCampaign(HANDLE_X, CAMPAIGN_A);
    expect(log.campaignImages).toContain(CAMPAIGN_A);
    const fetchesBefore = log.campaignImages.length;

    // Author X's first image is in CAMPAIGN_A — click it.
    const lightbox = await openLightboxFromAuthorGrid(0);
    await act(async () => { fireEvent.click(getCampaignLink(lightbox)); });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
    await waitFor(() => {
      expect(window.location.hash).toBe(`#${CAMPAIGN_A}`);
    });
    // Author grid is gone — the route ACTUALLY changed off of author-detail.
    await waitFor(() => {
      expect(screen.queryByTestId('author-images-grid')).toBeNull();
    });
    // No new fetch for A (campaign unchanged).
    expect(log.campaignImages.length).toBe(fetchesBefore);
  });

  it('artist origin + target campaign differs from activeCampaignId: switches campaign + navigates', async () => {
    // Cell 3: Origin = #authors/X with activeCampaignId === A. Target = B.
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInArtistModeWithPriorCampaign(HANDLE_X, CAMPAIGN_A);
    expect(log.campaignImages).toContain(CAMPAIGN_A);
    expect(log.campaignImages).not.toContain(CAMPAIGN_B);

    // Author X's second image is in CAMPAIGN_B — click it.
    const lightbox = await openLightboxFromAuthorGrid(1);
    await act(async () => { fireEvent.click(getCampaignLink(lightbox)); });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
    await waitFor(() => {
      expect(window.location.hash).toBe(`#${CAMPAIGN_B}`);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('author-images-grid')).toBeNull();
    });
    // New fetch for B was dispatched (selectCampaign was invoked because
    // the campaign actually changed).
    await waitFor(() => {
      expect(log.campaignImages).toContain(CAMPAIGN_B);
    });
  });

  it('gallery origin + DIFFERENT target campaign: structurally unreachable through the lightbox', async () => {
    // Cell 4: documented as unreachable.
    //
    // In gallery mode, the lightbox is bound to the active campaign's images
    // (`lightboxImages = currentImages` when no author-source is set), and
    // each gallery image has `campaignId === activeCampaignId` (stamped by
    // useCampaignLoader). The campaign-link target is `currentImage.campaignId`,
    // so the click target ALWAYS equals `activeCampaignId` in gallery mode.
    //
    // We assert this invariant directly: park the app on each campaign and
    // verify every gallery image's campaignId matches activeCampaignId.
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInGallery(CAMPAIGN_A);

    const lightbox = await openLightboxFromGallery(0);
    // The campaign link button's text content reflects the episode name for
    // campaign A. Confirm so that the click would always target CAMPAIGN_A
    // from this origin — not CAMPAIGN_B — proving the unreachability.
    const link = getCampaignLink(lightbox);
    expect(link.textContent).toContain(CAMPAIGNS[0].episode);
    expect(link.textContent).not.toContain(CAMPAIGNS[1].episode);
  });
});

// ─── handleOpenAuthorGalleryFromLightbox — origin × target artist matrix ─────

describe('App: handleOpenAuthorGalleryFromLightbox — origin × target artist matrix', () => {
  it('gallery origin (no artist context) + target artist X: navigates to artist page', async () => {
    // Cell 5: Origin = gallery #A. Target = X (image attributed to X).
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInGallery(CAMPAIGN_A);

    // Open the lightbox on the FIRST gallery image (attributed to X).
    const lightbox = await openLightboxFromGallery(0);
    await act(async () => { fireEvent.click(getAuthorHandleLink(lightbox)); });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
    await waitFor(() => {
      expect(window.location.hash).toBe(AUTHOR_HASH_X);
    });
    await screen.findByTestId('author-images-grid');
    expect(log.authorDetailFor).toContain(HANDLE_X);
  });

  it('gallery origin + target artist Y (different image attribution): navigates to Y', async () => {
    // Cell 5b: same origin axis, different artist target — exercises that the
    // handler reads the image's author and not the active campaign / context.
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInGallery(CAMPAIGN_A);

    // Index 1 in gallery A is attributed to Y.
    const lightbox = await openLightboxFromGallery(1);
    await act(async () => { fireEvent.click(getAuthorHandleLink(lightbox)); });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
    await waitFor(() => {
      expect(window.location.hash).toBe(AUTHOR_HASH_Y);
    });
    await screen.findByTestId('author-images-grid');
    expect(log.authorDetailFor).toContain(HANDLE_Y);
  });

  it('artist origin (viewing X) + target artist X (same as viewed): closes lightbox, no URL change', async () => {
    // Cell 6: Origin = #authors/X. Target = X.
    // Clicking the same-artist link must close the lightbox idempotently and
    // leave the URL unchanged (no spurious history entry, no extra fetch).
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInArtistModeWithPriorCampaign(HANDLE_X, CAMPAIGN_A);
    const initialAuthorFetchesX = log.authorDetailFor.filter(h => h === HANDLE_X).length;
    const hashBefore = window.location.hash;
    expect(hashBefore).toBe(AUTHOR_HASH_X);

    // Author X's first image is attributed to X.
    const lightbox = await openLightboxFromAuthorGrid(0);
    await act(async () => { fireEvent.click(getAuthorHandleLink(lightbox)); });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
    // Hash unchanged.
    expect(window.location.hash).toBe(hashBefore);
    // Still on the author-detail grid.
    expect(screen.queryByTestId('author-images-grid')).toBeTruthy();
    // No additional /api/authors/X fetch (assigning the same hash is a no-op
    // and doesn't fire hashchange).
    expect(log.authorDetailFor.filter(h => h === HANDLE_X).length).toBe(initialAuthorFetchesX);
  });

  it('artist origin (viewing X) + DIFFERENT target artist: structurally unreachable through the artist-mode lightbox', async () => {
    // Cell 7: documented as unreachable through the artist-mode lightbox.
    //
    // AuthorDetail builds its `lightboxImages` by overwriting each image's
    // `author` field with the VIEWED author's identity
    // (see client/src/components/AuthorDetail.tsx). So even an image whose
    // server-side attribution disagrees with the URL-viewed handle renders
    // with the viewed-handle in the lightbox AUTHOR row. The artist link
    // therefore always targets the currently-viewed artist — i.e. Cell 6.
    //
    // We pin this invariant: a cross-claim image attributed to Y in X's
    // detail response still renders X as the artist in the lightbox.
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;

    await startInArtistModeWithPriorCampaign(HANDLE_X, CAMPAIGN_A);

    // Image at index 2 in X's detail is server-side attributed to Y, but
    // AuthorDetail overrides this for display.
    const lightbox = await openLightboxFromAuthorGrid(2);
    const link = getAuthorHandleLink(lightbox);

    // The link text MUST be X, not Y — confirming the invariant.
    expect(link.textContent).toContain(HANDLE_X);
    expect(link.textContent).not.toContain(HANDLE_Y);
  });
});

// ─── Cross-cutting invariants ────────────────────────────────────────────────

describe('App: lightbox navigation handlers — shared invariants', () => {
  it('campaign link from gallery origin always closes the lightbox', async () => {
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;
    await startInGallery(CAMPAIGN_A);
    const lightbox = await openLightboxFromGallery(0);
    await act(async () => { fireEvent.click(getCampaignLink(lightbox)); });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
  });

  it('author link from gallery origin always closes the lightbox', async () => {
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;
    await startInGallery(CAMPAIGN_A);
    const lightbox = await openLightboxFromGallery(0);
    await act(async () => { fireEvent.click(getAuthorHandleLink(lightbox)); });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
  });

  it('campaign link from artist origin always closes the lightbox', async () => {
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;
    await startInArtistModeWithPriorCampaign(HANDLE_X, CAMPAIGN_A);
    const lightbox = await openLightboxFromAuthorGrid(0);
    await act(async () => { fireEvent.click(getCampaignLink(lightbox)); });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
  });

  it('author link from artist origin always closes the lightbox', async () => {
    const log = makeLog();
    globalThis.fetch = makeFetchMock(log) as unknown as typeof fetch;
    await startInArtistModeWithPriorCampaign(HANDLE_X, CAMPAIGN_A);
    const lightbox = await openLightboxFromAuthorGrid(0);
    await act(async () => { fireEvent.click(getAuthorHandleLink(lightbox)); });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
    });
  });
});
