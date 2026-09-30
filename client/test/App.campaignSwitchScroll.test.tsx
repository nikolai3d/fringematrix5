import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

// Switching campaigns resets the page scroll so the user starts at the top of
// the new grid instead of mid-page (or past the end of a smaller campaign).

const campaigns = ['one', 'two'].map((id) => ({
  id, episode: id, episode_id: '1.01', hashtag: id, date: '2010', icon_path: `S1/${id}`,
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
  window.scrollY = 0;
});

describe('App: campaign switch scroll reset', () => {
  it('scrolls to the top when moving to the next campaign from a scrolled page', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/campaigns') return jsonResponse({ campaigns });
      if (url.endsWith('/images')) return jsonResponse({ images: [] });
      return jsonResponse({ glyphs: [] });
    }) as unknown as typeof fetch;
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    await act(async () => { render(<App />); });
    await waitFor(() => expect(screen.getByTestId('current-campaign-top').textContent).toContain('#one'));

    window.scrollY = 1500;
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Next campaign' })[0]!);
    });

    await waitFor(() => expect(window.location.hash).toBe('#two'));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});
