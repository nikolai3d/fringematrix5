import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

/**
 * Shared-image deep links (fringematrix5-nzp2.3).
 *
 * The lightbox Share button produces `?img=<id>#<campaign>`. Before this fix
 * the app never read the param, so recipients landed on the grid instead of
 * the shared image. These tests pin the round trip: the link opens the
 * lightbox at the right image once loading finishes, the param is stripped
 * from the URL afterwards, and unmatched/legacy links degrade gracefully.
 */

const CAMPAIGN = {
  id: 'crosstheline',
  episode: 'Cross The Line',
  episode_id: '4.18',
  hashtag: 'CrossTheLine',
  date: '2012-04-13',
  icon_path: 'Season4/CrossTheLine',
};

const IMAGES = ['a', 'b', 'c'].map((n) => ({
  id: `id-${n}`,
  src: `https://store.public.blob.vercel-storage.com/avatars/Season4/CrossTheLine/${n}.jpg`,
  fileName: `${n}.jpg`,
  blobPath: `avatars/Season4/CrossTheLine/${n}.jpg`,
  size: 1,
  author: null,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/campaigns') return jsonResponse({ campaigns: [CAMPAIGN] });
    if (url === `/api/campaigns/${CAMPAIGN.id}/images`) return jsonResponse({ images: IMAGES });
    if (url === '/api/glyphs') return jsonResponse({ glyphs: [] });
    if (url === '/api/authors') return jsonResponse({ authors: [], unknownCount: 0 });
    if (url.startsWith('/api/authors/')) {
      return jsonResponse({ author: { handle: '@x', name: 'X', twitterUrl: null, alternateHandles: [], roles: [] }, images: [] });
    }
    return jsonResponse({ error: `Unmocked URL: ${url}` }, 404);
  });
}

const originalFetch = globalThis.fetch;
// Some tests stub navigator.share / navigator.clipboard; restore the original
// descriptors so the stubs don't leak into other tests.
const originalShareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function restoreNavigatorProp(name: 'share' | 'clipboard', descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(navigator, name, descriptor);
  else delete (navigator as unknown as Record<string, unknown>)[name];
}

beforeEach(() => {
  // reduceMotion makes openLightbox synchronous (no zoom animation).
  window.localStorage.setItem(
    'fringematrix-a11y',
    JSON.stringify({ reduceMotion: true, reduceEffects: true, thumbnailSizeIndex: 0 }),
  );
  globalThis.fetch = makeFetchMock() as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreNavigatorProp('share', originalShareDescriptor);
  restoreNavigatorProp('clipboard', originalClipboardDescriptor);
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});

async function renderApp() {
  await act(async () => {
    render(<App />);
  });
}

describe('App: shared-image deep link (?img=)', () => {
  it('opens the lightbox at the shared image (by id) and strips the param, keeping the hash', async () => {
    window.history.replaceState({}, '', `/?img=id-b#${CAMPAIGN.id}`);
    await renderApp();

    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i }, { timeout: 4000 });
    const hud = lightbox.querySelector('.lightbox-hud');
    expect(hud?.textContent).toContain('b.jpg');
    expect(hud?.textContent).toContain('2 OF 3');

    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe(`#${CAMPAIGN.id}`);
  });

  it('still opens legacy links that carried the full CDN src', async () => {
    const search = new URLSearchParams({ img: IMAGES[2]!.src }).toString();
    window.history.replaceState({}, '', `/?${search}#${CAMPAIGN.id}`);
    await renderApp();

    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i }, { timeout: 4000 });
    expect(lightbox.querySelector('.lightbox-hud')?.textContent).toContain('3 OF 3');
  });

  it('does not open anything for an unknown image, but still cleans the URL and keeps other params', async () => {
    window.history.replaceState({}, '', `/?utm=x&img=missing#${CAMPAIGN.id}`);
    await renderApp();

    await waitFor(() => expect(window.location.search).toBe('?utm=x'), { timeout: 4000 });
    expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
  });

  it('does not open the lightbox on non-gallery routes', async () => {
    window.history.replaceState({}, '', '/?img=id-a#authors');
    await renderApp();

    await waitFor(() => expect(window.location.search).toBe(''), { timeout: 4000 });
    expect(window.location.hash).toBe('#authors');
    expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
  });

  it('is consumed once: closing the lightbox does not reopen it', async () => {
    window.history.replaceState({}, '', `/?img=id-a#${CAMPAIGN.id}`);
    await renderApp();
    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i }, { timeout: 4000 });

    await act(async () => {
      fireEvent.click(lightbox.querySelector('#lightbox-close')!);
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull());
    // Give any stray effect a chance to re-fire.
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByRole('dialog', { name: /image viewer/i })).toBeNull();
  });

  it('the lightbox Share button produces an id-based link that round-trips', async () => {
    window.history.replaceState({}, '', `/?img=id-c#${CAMPAIGN.id}`);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    await renderApp();
    const lightbox = await screen.findByRole('dialog', { name: /image viewer/i }, { timeout: 4000 });

    await act(async () => {
      fireEvent.click(lightbox.querySelector('#share-btn')!);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const shared = new URL(writeText.mock.calls[0]![0] as string);
    expect(shared.searchParams.get('img')).toBe('id-c');
    expect(shared.hash).toBe(`#${CAMPAIGN.id}`);
  });
});
