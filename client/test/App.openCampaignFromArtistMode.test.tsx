import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

/**
 * Regression test for fringematrix5-u7gd: when the user is in artist-browse
 * mode (route = author-detail) and the lightbox is showing an image whose
 * source campaign happens to equal `activeCampaignId` (which was set BEFORE
 * the user entered artist mode), clicking the campaign link in the lightbox
 * info box must navigate to that campaign's gallery view.
 *
 * Previously the handler short-circuited when `campaignId === activeCampaignId`
 * and never updated the route off of `{type: 'author-detail'}`, leaving the
 * user stranded on the artist page after the lightbox closed.
 */

const HANDLE = '@Zort70';
const AUTHOR_HASH = `#authors/${encodeURIComponent(HANDLE)}`;
const CAMPAIGN_ID = 'crosstheline';
const OTHER_CAMPAIGN_ID = 'letters';

// Author has images in TWO campaigns. The FIRST image's campaign matches the
// app's initial activeCampaignId (`crosstheline`) — that's the bug path.
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
      campaignId: CAMPAIGN_ID,
      confidence: 'high' as const,
    },
    {
      src: '/avatars/Season4/Letters/ghi.jpg',
      fileName: 'ghi.jpg',
      blobPath: 'avatars/Season4/Letters/ghi.jpg',
      campaignId: OTHER_CAMPAIGN_ID,
      confidence: 'high' as const,
    },
  ],
};

const CAMPAIGNS = [
  {
    id: CAMPAIGN_ID,
    episode: 'Cross The Line',
    episode_id: 'S04E18',
    hashtag: 'CrossTheLine',
    date: '2012-04-13',
    icon_path: 'Season4/CrossTheLine',
  },
  {
    id: OTHER_CAMPAIGN_ID,
    episode: 'Letters of Transit',
    episode_id: 'S04E19',
    hashtag: 'Letters',
    date: '2012-04-20',
    icon_path: 'Season4/Letters',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('/api/campaigns/') && url.endsWith('/images')) {
      // Empty image lists keep the campaign-load dance fast; the lightbox
      // here is bound to the author's image list, not the campaign's.
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
    if (url === `/api/authors/${encodeURIComponent(HANDLE)}`) {
      return jsonResponse(SAMPLE_AUTHOR_DETAIL);
    }

    return jsonResponse({ error: `Unmocked URL: ${url}` }, 404);
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  window.localStorage.setItem(
    'fringematrix-a11y',
    JSON.stringify({ reduceMotion: true, reduceEffects: true, thumbnailSizeIndex: 0 }),
  );
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, '', window.location.pathname);
});

describe('App: campaign-link navigation from artist-browse lightbox (fringematrix5-u7gd)', () => {
  it('navigates to the gallery when the lightbox image campaign equals activeCampaignId', async () => {
    // Simulate the repro path: start on the campaign gallery so
    // activeCampaignId becomes CAMPAIGN_ID, THEN enter artist-browse mode.
    window.location.hash = CAMPAIGN_ID;
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    // Wait for the campaign to actually load (activeCampaignId becomes CAMPAIGN_ID).
    // We can detect this indirectly by waiting until the campaigns fetch settled.
    await waitFor(() => {
      // The Home button is unconditionally rendered once campaigns load;
      // checking it ensures App is past the loading screen.
      expect(screen.queryByRole('button', { name: /go to home/i })).toBeTruthy();
    });

    // Now navigate into artist-browse mode by setting the hash. This mimics
    // the user clicking an artist link from inside a campaign-gallery lightbox.
    await act(async () => {
      window.location.hash = AUTHOR_HASH;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // Wait for the author-detail grid to render.
    const grid = await screen.findByTestId('author-images-grid');
    const imgs = grid.querySelectorAll('img');
    expect(imgs.length).toBe(2);

    // Click the FIRST thumbnail — its source campaign matches the previously
    // active campaign. This is the bug path.
    await act(async () => {
      fireEvent.click(imgs[0]!);
    });

    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i });
    expect(lightbox).toBeTruthy();

    // Find and click the campaign-link button in the lightbox details. It
    // carries the dedicated `lightbox-details-campaign-link` class.
    const campaignLink = lightbox.querySelector(
      'button.lightbox-details-campaign-link',
    ) as HTMLButtonElement | null;
    expect(campaignLink).toBeTruthy();

    await act(async () => {
      fireEvent.click(campaignLink!);
    });

    // Expected: hash and route flip to the campaign gallery view. Previously
    // the route stayed on #authors/<handle> because the handler short-circuited.
    await waitFor(() => {
      expect(window.location.hash).toBe(`#${CAMPAIGN_ID}`);
    });

    // The author-detail grid must no longer be on screen — confirming the
    // route actually flipped to the gallery view.
    await waitFor(() => {
      expect(screen.queryByTestId('author-images-grid')).toBeNull();
    });
  });

  it('still navigates correctly when the lightbox image campaign differs from activeCampaignId', async () => {
    // Sanity-check the non-buggy path: clicking the campaign link for an
    // image whose campaign differs from activeCampaignId continues to work.
    window.location.hash = CAMPAIGN_ID;
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /go to home/i })).toBeTruthy();
    });

    await act(async () => {
      window.location.hash = AUTHOR_HASH;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    const grid = await screen.findByTestId('author-images-grid');
    const imgs = grid.querySelectorAll('img');

    // Click the SECOND thumbnail — its campaign (`letters`) differs from
    // the currently active campaign (`crosstheline`).
    await act(async () => {
      fireEvent.click(imgs[1]!);
    });

    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i });
    const campaignLink = lightbox.querySelector(
      'button.lightbox-details-campaign-link',
    ) as HTMLButtonElement | null;
    expect(campaignLink).toBeTruthy();

    await act(async () => {
      fireEvent.click(campaignLink!);
    });

    await waitFor(() => {
      expect(window.location.hash).toBe(`#${OTHER_CAMPAIGN_ID}`);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('author-images-grid')).toBeNull();
    });
  });
});
