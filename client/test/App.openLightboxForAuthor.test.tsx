import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

/**
 * App-level integration test for the openLightboxForAuthor wiring added in
 * fringematrix5-ik5. The existing AuthorDetail unit test
 * (client/test/AuthorDetail.test.tsx) covers the `onOpenImage` prop contract;
 * this test covers the App-side wiring — that App.openLightboxForAuthor:
 *
 *   1. Opens the lightbox at the clicked index against the author's full
 *      image list (NOT the active campaign's images), and
 *   2. Does NOT mutate window.location.hash (the user stays on
 *      #authors/:handle so back-navigation keeps working).
 *
 * Filed as fringematrix5-w18z per a Copilot review suggestion on PR #178 so
 * future routing/lightbox refactors can't silently regress author-browse mode.
 */

const HANDLE = '@Zort70';
const AUTHOR_HASH = `#authors/${encodeURIComponent(HANDLE)}`;

const SAMPLE_AUTHOR_DETAIL = {
  author: {
    handle: HANDLE,
    name: 'Sarah Proost',
    twitterUrl: 'https://twitter.com/Zort70',
    alternateHandles: [],
    roles: ['artist'],
  },
  images: [
    {
      src: '/avatars/Season4/CrossTheLine/abc.jpg',
      fileName: 'abc.jpg',
      blobPath: 'avatars/Season4/CrossTheLine/abc.jpg',
      campaignId: 'crosstheline',
      confidence: 'high' as const,
    },
    {
      src: '/avatars/Season4/CrossTheLine/def.jpg',
      fileName: 'def.jpg',
      blobPath: 'avatars/Season4/CrossTheLine/def.jpg',
      campaignId: 'crosstheline',
      confidence: 'high' as const,
    },
    {
      src: '/avatars/Season4/Letters/ghi.jpg',
      fileName: 'ghi.jpg',
      blobPath: 'avatars/Season4/Letters/ghi.jpg',
      campaignId: 'letters',
      confidence: 'high' as const,
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Lightweight fetch router that returns canned JSON for the endpoints App
 * hits on mount. Anything unknown 404s — surfaces unexpected requests as a
 * test failure rather than a silent network hang.
 */
function makeFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('/api/campaigns/') && url.endsWith('/images')) {
      // App preloads the first campaign's images on mount even when the
      // initial hash route is non-gallery. Return an empty list to skip the
      // <Image> preloading dance entirely.
      return jsonResponse({ images: [] });
    }
    if (url === '/api/campaigns') {
      // Provide a single campaign so App has *something* to consider, but
      // the author-detail route still takes precedence for what gets rendered.
      return jsonResponse({
        campaigns: [
          {
            id: 'crosstheline',
            episode: 'Cross The Line',
            episode_id: 'S04E18',
            hashtag: 'CrossTheLine',
            date: '2012-04-13',
            icon_path: 'Season4/CrossTheLine',
          },
        ],
      });
    }
    if (url === '/api/build-info') {
      return jsonResponse({ commitHash: 'dev-local', deployedAt: null });
    }
    if (url === '/api/glyphs') {
      // FringeGlyphLoadingSpinner fetches this on mount; return an empty
      // list so it logs nothing and stays out of the way of the test.
      return jsonResponse({ glyphs: [] });
    }
    if (url === `/api/authors/${encodeURIComponent(HANDLE)}`) {
      return jsonResponse(SAMPLE_AUTHOR_DETAIL);
    }
    if (url === '/api/authors') {
      // App lazily fetches the artists list when landing on an authors route
      // so the nav-switcher in the top/bottom navbars can render prev/next +
      // the active artist's name. Tests in this file mount the App directly
      // onto an author-detail hash, which triggers that fetch — return an
      // empty list to silence the "failed to load" log without changing
      // assertions (the switcher just stays disabled with the URL handle).
      return jsonResponse({ authors: [] });
    }

    return jsonResponse({ error: `Unmocked URL: ${url}` }, 404);
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  // reduceMotion=true short-circuits the lightbox open animation so
  // setIsLightboxOpen fires synchronously and the lightbox is queryable
  // immediately after the click. App reads this on mount from localStorage.
  window.localStorage.setItem(
    'fringematrix-a11y',
    JSON.stringify({ reduceMotion: true, reduceEffects: true, thumbnailSizeIndex: 0 }),
  );
  // Park App on the author-detail route from first paint.
  window.location.hash = AUTHOR_HASH;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  window.localStorage.clear();
  // Clear the hash so it doesn't leak between tests.
  window.history.replaceState({}, '', window.location.pathname);
});

describe('App: openLightboxForAuthor wiring (fringematrix5-w18z)', () => {
  it('clicking an author thumbnail opens the lightbox at the clicked index without changing the URL hash', async () => {
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    // Wait for the author-detail grid to render after /api/authors resolves.
    // Post-jq33 the grid is the shared GalleryGrid, which attaches onClick to
    // the <img> directly (no wrapping <button>).
    const grid = await screen.findByTestId('author-images-grid');
    const imgs = grid.querySelectorAll('img');
    expect(imgs.length).toBe(3);

    const hashBeforeClick = window.location.hash;
    expect(hashBeforeClick).toBe(AUTHOR_HASH);

    // Click the SECOND thumbnail (index 1). The lightbox should open against
    // the author's image list at that index — not against the (empty) active
    // campaign's images.
    await act(async () => {
      fireEvent.click(imgs[1]!);
    });

    // The lightbox dialog renders once isLightboxOpen flips. With
    // reduceMotion=true this is synchronous within openLightbox.
    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i });
    expect(lightbox).toBeTruthy();

    // The HUD encodes both the active filename and "N OF M" — pin both so a
    // regression that opened on the wrong index (e.g. 0 instead of 1) or
    // against the wrong image list (e.g. the campaign images, length 0)
    // would fail loudly.
    const hud = lightbox.querySelector('.lightbox-hud');
    expect(hud?.textContent).toContain('def.jpg');
    expect(hud?.textContent).toContain('2 OF 3');

    // The <img> rendered inside the lightbox should be the clicked image —
    // direct cross-check on the actual src attribute used by the viewer,
    // independent of the HUD text. Index 1 is the second author image.
    const lightboxImg = lightbox.querySelector('#lightbox-image') as HTMLImageElement | null;
    expect(lightboxImg?.getAttribute('src')).toBe(SAMPLE_AUTHOR_DETAIL.images[1].src);

    // Critical: the hash must NOT have been mutated. openLightboxForAuthor is
    // explicitly hash-agnostic so closing the lightbox returns the user to
    // the author-detail page they came from.
    expect(window.location.hash).toBe(hashBeforeClick);
  });

  it('clicking the first thumbnail opens the lightbox at index 0 against the author image list', async () => {
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    const grid = await screen.findByTestId('author-images-grid');
    const imgs = grid.querySelectorAll('img');

    await act(async () => {
      fireEvent.click(imgs[0]!);
    });

    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i });
    const hud = lightbox.querySelector('.lightbox-hud');

    // Index 0 → "1 OF 3" and the first author image's filename.
    expect(hud?.textContent).toContain('abc.jpg');
    expect(hud?.textContent).toContain('1 OF 3');

    // Hash still unchanged on the index-0 path.
    expect(window.location.hash).toBe(AUTHOR_HASH);
  });

  it('lightbox image list spans the author images (cross-campaign), not the active campaign images', async () => {
    // Belt-and-braces guard for the source-of-truth wiring: with the active
    // campaign deliberately empty (mocked above) and the author having
    // images in TWO different campaigns, paging by changing lightbox index
    // via the NEXT button should still reach images from the second campaign.
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    const grid = await screen.findByTestId('author-images-grid');
    const imgs = grid.querySelectorAll('img');

    await act(async () => {
      fireEvent.click(imgs[0]!);
    });

    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i });

    // Press NEXT twice to advance from index 0 → 2.
    const nextBtn = lightbox.querySelector('button[aria-label="Next image"]') as HTMLButtonElement | null;
    expect(nextBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(nextBtn!);
    });
    await act(async () => {
      fireEvent.click(nextBtn!);
    });

    // After two NEXT clicks we should be looking at the third author image
    // (which lives in a different campaign than the first two). If the
    // lightbox were bound to the active campaign's images (length 0) it
    // would have nothing to advance to and the HUD would never read this.
    await waitFor(() => {
      const hud = lightbox.querySelector('.lightbox-hud');
      expect(hud?.textContent).toContain('ghi.jpg');
      expect(hud?.textContent).toContain('3 OF 3');
    });

    // Still no hash mutation from inside the lightbox.
    expect(window.location.hash).toBe(AUTHOR_HASH);
  });
});
