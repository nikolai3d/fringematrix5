import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

// A failed image-list request must say so (with Retry) instead of claiming the
// campaign has no images. The old "Some images failed to load" notice could
// never render because it lived inside the loading indicator.

const campaign = { id: 'one', episode: 'One', episode_id: '1.01', hashtag: 'One', date: '2010', icon_path: 'S1/One' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('App: campaign image-list failure', () => {
  it('shows an error state with Retry, and Retry loads the images', async () => {
    let fail = true;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/campaigns') return json({ campaigns: [campaign] });
      if (url === '/api/campaigns/one/images') {
        return fail
          ? json({ error: 'Vercel Blob unavailable' }, 503)
          : json({ images: [{ src: 'https://cdn/a.jpg', fileName: 'a.jpg', blobPath: 'avatars/a.jpg', id: 'a' }] });
      }
      return json({ glyphs: [] });
    }) as unknown as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => { render(<App />); });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't Load Images");
    expect(screen.queryByText('No Images In Campaign')).toBeNull();

    fail = false;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() => expect(document.querySelectorAll('.gallery-grid .card').length).toBe(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still shows the plain empty state for a campaign that really has no images', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/campaigns') return json({ campaigns: [campaign] });
      if (url.endsWith('/images')) return json({ images: [] });
      return json({ glyphs: [] });
    }) as unknown as typeof fetch;

    await act(async () => { render(<App />); });
    expect(await screen.findByText('No Images In Campaign')).toBeTruthy();
    expect(screen.queryByText("Couldn't Load Images")).toBeNull();
  });
});
