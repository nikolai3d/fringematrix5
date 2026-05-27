import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

/**
 * App-level test for the artist nav-switcher added in fringematrix5-urzh:
 *
 * In artist-browse mode (route.type === 'author-detail'), the top and bottom
 * navbars below the primary button toolbar should:
 *   - Show the active artist's name (NOT the active campaign's hashtag).
 *   - Provide prev/next arrows that cycle through the artists list and update
 *     the URL hash to the next artist's detail page.
 *
 * In gallery mode the existing campaign-switching behavior must be preserved.
 */

const HANDLE_A = '@AliceArt';
const HANDLE_B = '@BobArt';
const HANDLE_C = '@CarolArt';
const AUTHOR_HASH_A = `#authors/${encodeURIComponent(HANDLE_A)}`;
const AUTHOR_HASH_B = `#authors/${encodeURIComponent(HANDLE_B)}`;
const AUTHOR_HASH_C = `#authors/${encodeURIComponent(HANDLE_C)}`;

const SAMPLE_AUTHORS = [
  { handle: HANDLE_A, name: 'Alice Artist', twitterUrl: null, alternateHandles: [], roles: ['artist'], imageCount: 5 },
  { handle: HANDLE_B, name: 'Bob Artist', twitterUrl: null, alternateHandles: [], roles: ['artist'], imageCount: 3 },
  { handle: HANDLE_C, name: 'Carol Artist', twitterUrl: null, alternateHandles: [], roles: ['artist'], imageCount: 1 },
];

function authorDetailFor(handle: string, name: string) {
  return {
    author: { handle, name, twitterUrl: null, alternateHandles: [], roles: ['artist'] },
    images: [],
  };
}

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
      return jsonResponse({ images: [] });
    }
    if (url === '/api/campaigns') {
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
      return jsonResponse({ glyphs: [] });
    }
    if (url === '/api/authors') {
      return jsonResponse({ authors: SAMPLE_AUTHORS });
    }
    if (url === `/api/authors/${encodeURIComponent(HANDLE_A)}`) {
      return jsonResponse(authorDetailFor(HANDLE_A, 'Alice Artist'));
    }
    if (url === `/api/authors/${encodeURIComponent(HANDLE_B)}`) {
      return jsonResponse(authorDetailFor(HANDLE_B, 'Bob Artist'));
    }
    if (url === `/api/authors/${encodeURIComponent(HANDLE_C)}`) {
      return jsonResponse(authorDetailFor(HANDLE_C, 'Carol Artist'));
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

describe('App: artist nav-switcher in author-browse mode (fringematrix5-urzh)', () => {
  it('renders the active artist name (not the campaign hashtag) in the top + bottom navbars', async () => {
    window.location.hash = AUTHOR_HASH_A;
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    // Wait until the artists list resolves and the nav switcher displays
    // the resolved display name.
    const top = await waitFor(() => {
      const el = screen.getByTestId('current-artist-top');
      expect(el.textContent).toBe('Alice Artist');
      return el;
    });
    expect(top.textContent).toBe('Alice Artist');

    const bottom = screen.getByTestId('current-artist-bottom');
    expect(bottom.textContent).toBe('Alice Artist');

    // Campaign-mode test ids must not be in the DOM while we're on the
    // author-detail route — proves we branched the navbar, not just added a
    // second one.
    expect(screen.queryByTestId('current-campaign-top')).toBeNull();
    expect(screen.queryByTestId('current-campaign-bottom')).toBeNull();
  });

  it('falls back to the URL handle while the artists list is still loading', async () => {
    window.location.hash = AUTHOR_HASH_A;

    // Custom mock that hangs the /api/authors call so we can observe the
    // pre-fetch fallback state.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/authors') {
        // Never resolves — emulates an in-flight fetch.
        return new Promise<Response>(() => { /* hangs forever */ });
      }
      if (url.startsWith('/api/campaigns/') && url.endsWith('/images')) {
        return jsonResponse({ images: [] });
      }
      if (url === '/api/campaigns') {
        return jsonResponse({ campaigns: [] });
      }
      if (url === '/api/build-info') {
        return jsonResponse({ commitHash: 'dev-local', deployedAt: null });
      }
      if (url === '/api/glyphs') {
        return jsonResponse({ glyphs: [] });
      }
      if (url === `/api/authors/${encodeURIComponent(HANDLE_A)}`) {
        return jsonResponse(authorDetailFor(HANDLE_A, 'Alice Artist'));
      }
      return jsonResponse({ error: `Unmocked URL: ${url}` }, 404);
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    const top = await screen.findByTestId('current-artist-top');
    expect(top.textContent).toBe(HANDLE_A);
  });

  it('clicking the next-artist arrow navigates to the next artist in the list', async () => {
    window.location.hash = AUTHOR_HASH_A;
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    // Wait for the resolved name to appear so we know the artists list has
    // loaded — only then are the arrows enabled.
    await waitFor(() => {
      expect(screen.getByTestId('current-artist-top').textContent).toBe('Alice Artist');
    });

    const nextBtn = screen.getAllByRole('button', { name: /next artist/i })[0]!;

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    // Hash should have advanced to the next artist (Bob).
    expect(window.location.hash).toBe(AUTHOR_HASH_B);

    // And the nav title should reflect Bob after the hashchange.
    await waitFor(() => {
      expect(screen.getByTestId('current-artist-top').textContent).toBe('Bob Artist');
    });
  });

  it('clicking next-artist on the last artist wraps to the first', async () => {
    window.location.hash = AUTHOR_HASH_C;
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-artist-top').textContent).toBe('Carol Artist');
    });

    const nextBtn = screen.getAllByRole('button', { name: /next artist/i })[0]!;
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(window.location.hash).toBe(AUTHOR_HASH_A);
  });

  it('clicking the prev-artist arrow navigates to the previous artist (with wrap)', async () => {
    window.location.hash = AUTHOR_HASH_A;
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-artist-top').textContent).toBe('Alice Artist');
    });

    const prevBtn = screen.getAllByRole('button', { name: /previous artist/i })[0]!;
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // From Alice (first), prev wraps to Carol (last).
    expect(window.location.hash).toBe(AUTHOR_HASH_C);
  });

  it('preserves the campaign nav-switcher in gallery mode', async () => {
    window.location.hash = '#crosstheline';
    globalThis.fetch = makeFetchMock() as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    // The campaign-mode test ids must still render in gallery mode.
    const top = await screen.findByTestId('current-campaign-top');
    expect(top.textContent).toBe('#CrossTheLine');

    // And the artist-mode test ids must NOT be present.
    expect(screen.queryByTestId('current-artist-top')).toBeNull();
    expect(screen.queryByTestId('current-artist-bottom')).toBeNull();
  });

  // Error-path coverage (fringematrix5-ok8g): when the App-level /api/authors
  // fetch fails (e.g. 5xx), the switcher catch block sets artists to [] so we
  // stop retrying. The nav title falls back to the raw URL handle and both
  // prev/next arrows must remain disabled (length <= 1).
  it('falls back to the URL handle and keeps arrows disabled when /api/authors returns 5xx', async () => {
    window.location.hash = AUTHOR_HASH_A;

    // Silence the expected console.error from the App's catch block so the
    // test output stays clean. We still want any *unexpected* errors to
    // surface during the run, so we restore in afterEach via vi.restoreAllMocks.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* swallow */ });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/authors') {
        // Simulate a server-side failure. fetchJSON throws on non-2xx, which
        // routes into the App effect's catch → setArtists([]).
        return jsonResponse({ error: 'internal' }, 500);
      }
      if (url.startsWith('/api/campaigns/') && url.endsWith('/images')) {
        return jsonResponse({ images: [] });
      }
      if (url === '/api/campaigns') {
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
        return jsonResponse({ glyphs: [] });
      }
      if (url === `/api/authors/${encodeURIComponent(HANDLE_A)}`) {
        return jsonResponse(authorDetailFor(HANDLE_A, 'Alice Artist'));
      }
      return jsonResponse({ error: `Unmocked URL: ${url}` }, 404);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    // After the /api/authors fetch rejects, the catch block sets artists=[]
    // (so we stop retrying). The nav title falls back to the URL handle.
    const top = await screen.findByTestId('current-artist-top');
    await waitFor(() => {
      expect(top.textContent).toBe(HANDLE_A);
    });

    // Both arrows must be disabled because artists.length === 0 (<= 1).
    const prevBtn = screen.getAllByRole('button', { name: /previous artist/i })[0]!;
    const nextBtn = screen.getAllByRole('button', { name: /next artist/i })[0]!;
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);

    // The App's catch block should have logged the failure exactly once —
    // proves we actually hit the error branch (not, say, a hung fetch).
    expect(errSpy).toHaveBeenCalled();

    // Stronger behavioral guard (per Copilot review on PR #192): leave the
    // author-detail route and come back. The lazy-fetch effect re-evaluates
    // when `route.type` changes back to `'author-detail'`. If the catch
    // block correctly called `setArtists([])`, the effect's early-return
    // (`if (artists !== null) return;`) fires and NO new /api/authors
    // request is made — locking in the "stop retrying after failure"
    // behavior. If a future refactor dropped the `setArtists([])` call,
    // `artists` would stay `null` and this round-trip would re-fetch,
    // bumping the call count to >1 and failing the test.
    const authorsCallsAfterFailure = fetchMock.mock.calls.filter(
      ([input]) => (typeof input === 'string' ? input : (input as URL).toString()) === '/api/authors',
    ).length;
    expect(authorsCallsAfterFailure).toBe(1);

    // Round-trip: author-detail → gallery → author-detail.
    await act(async () => {
      window.location.hash = '#crosstheline';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => {
      // Wait for gallery mode to render so we know the route transition
      // settled before we go back.
      expect(screen.queryByTestId('current-artist-top')).toBeNull();
    });
    await act(async () => {
      window.location.hash = AUTHOR_HASH_A;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('current-artist-top')).toBeTruthy();
    });

    // Still exactly one /api/authors request — proves the catch set
    // artists=[] and the early-return is doing its job.
    const authorsCallsAfterRoundTrip = fetchMock.mock.calls.filter(
      ([input]) => (typeof input === 'string' ? input : (input as URL).toString()) === '/api/authors',
    ).length;
    expect(authorsCallsAfterRoundTrip).toBe(1);
  });

  // Regression coverage (fringematrix5-ok8g): visiting #authors (the
  // authors-index page) must NOT trigger the App-level /api/authors fetch.
  // AuthorsIndex does its own fetch with its own loading/error state; the
  // App-level lazy fetch is scoped to `route.type === 'author-detail'`. Locks
  // in the Copilot-suggested narrowing from PR #188 so a future refactor that
  // relaxes the route guard would fail this test.
  it('does NOT trigger the App-level /api/authors fetch on the authors-index route', async () => {
    window.location.hash = '#authors';
    const fetchMock = makeFetchMock();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await act(async () => {
      render(<App />);
    });

    // Wait for AuthorsIndex to finish its own fetch + render so we know the
    // initial render pass has settled. The "Artists" heading is rendered
    // synchronously by AuthorsIndex; the resolved card list waits for the
    // fetch. Either signal is fine — using the resolved card list also
    // guarantees the AuthorsIndex fetch has completed before we count.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /artists/i })).toBeTruthy();
    });
    await waitFor(() => {
      // Cards render after the fetch resolves. One of our sample authors must
      // be visible — proves the AuthorsIndex fetch ran and resolved.
      expect(screen.getByText('Alice Artist')).toBeTruthy();
    });

    // Count /api/authors calls. AuthorsIndex itself fires exactly one fetch.
    // If the App-level effect also fired on the authors-index route, we'd
    // see 2 calls. Anything > 1 means the route-guard narrowing regressed.
    const authorsCalls = (fetchMock.mock.calls as Array<[RequestInfo | URL, unknown?]>).filter(
      ([input]) => (typeof input === 'string' ? input : input.toString()) === '/api/authors',
    );
    expect(authorsCalls.length).toBe(1);

    // Sanity-check: we shouldn't be rendering the artist nav-switcher on the
    // authors-index page either (it's an author-detail-only widget).
    expect(screen.queryByTestId('current-artist-top')).toBeNull();
    expect(screen.queryByTestId('current-artist-bottom')).toBeNull();
  });
});
