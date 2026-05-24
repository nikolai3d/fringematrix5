import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import AuthorDetail from '../src/components/AuthorDetail';

const SAMPLE_DETAIL = {
  author: {
    handle: '@Zort70',
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
  ],
};

function mockFetch(response: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('AuthorDetail', () => {
  it('fetches /api/authors/:handle with the handle URL-encoded and renders header + images', async () => {
    const fetchSpy = mockFetch(SAMPLE_DETAIL);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(
      <AuthorDetail
        handle="@Zort70"
        onBack={() => {}}
        onOpenImage={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sarah Proost')).toBeTruthy();
    });

    // URL-encoded handle in the request
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/api/authors/%40Zort70');

    // Header bits
    expect(screen.getByRole('link', { name: '@Zort70' }).getAttribute('href'))
      .toBe('https://twitter.com/Zort70');
    expect(screen.getByText('2 images')).toBeTruthy();

    // Two thumbnails rendered
    const grid = screen.getByTestId('author-images-grid');
    expect(grid.querySelectorAll('img').length).toBe(2);
  });

  it('opens the lightbox in author-browse mode with the full image list + clicked index + thumb element', async () => {
    globalThis.fetch = mockFetch(SAMPLE_DETAIL) as unknown as typeof fetch;
    const onOpenImage = vi.fn();

    render(
      <AuthorDetail
        handle="@Zort70"
        onBack={() => {}}
        onOpenImage={onOpenImage}
      />,
    );

    const grid = await screen.findByTestId('author-images-grid');
    // AuthorDetail now renders the shared GalleryGrid, which attaches the
    // click handler directly to the <img> (no wrapping <button>). Drive the
    // click off the <img> tags. (fringematrix5-jq33.)
    const imgs = grid.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    fireEvent.click(imgs[0]!);

    // 1st arg: full image list mapped to ImageData with synthesized author
    // and per-image campaignId. 2nd: clicked index. 3rd: handle. 4th: the
    // <img> element clicked — forwarded so App.openLightboxForAuthor can
    // seed the zoom-in flight's source rect (parity with campaign gallery).
    expect(onOpenImage).toHaveBeenCalledTimes(1);
    const [images0, index0, handle0, thumb0] = onOpenImage.mock.calls[0]!;
    expect(handle0).toBe('@Zort70');
    expect(index0).toBe(0);
    expect(thumb0).toBe(imgs[0]);
    expect(images0).toHaveLength(2);
    expect(images0[0]).toMatchObject({
      fileName: 'abc.jpg',
      src: '/avatars/Season4/CrossTheLine/abc.jpg',
      blobPath: 'avatars/Season4/CrossTheLine/abc.jpg',
      campaignId: 'crosstheline',
      author: {
        handle: '@Zort70',
        displayName: 'Sarah Proost',
        twitterUrl: 'https://twitter.com/Zort70',
        confidence: 'high',
        candidates: [],
      },
    });
    expect(images0[1]).toMatchObject({
      fileName: 'def.jpg',
      blobPath: 'avatars/Season4/CrossTheLine/def.jpg',
      campaignId: 'crosstheline',
    });

    // Clicking a different thumbnail dispatches the matching index. Guards
    // against a regression where the click handler captures the wrong row
    // from the map.
    fireEvent.click(imgs[1]!);
    const [, index1, handle1, thumb1] = onOpenImage.mock.calls[1]!;
    expect(index1).toBe(1);
    expect(handle1).toBe('@Zort70');
    expect(thumb1).toBe(imgs[1]);
  });

  it('clears stale data and error when the handle prop changes', async () => {
    // First render: successful response for @first.
    const FIRST = {
      ...SAMPLE_DETAIL,
      author: { ...SAMPLE_DETAIL.author, handle: '@first', name: 'First Person' },
    };
    let callIdx = 0;
    const fetchSpy = vi.fn(async () => {
      const body = callIdx++ === 0
        ? FIRST
        : { error: 'not found' };
      const status = callIdx === 1 ? 200 : 404;
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <AuthorDetail handle="@first" onBack={() => {}} onOpenImage={() => {}} />,
    );
    await screen.findByText('First Person');

    // Re-render with a different handle — the previous "First Person" header
    // and image grid should disappear immediately while the new fetch runs.
    rerender(
      <AuthorDetail handle="@second" onBack={() => {}} onOpenImage={() => {}} />,
    );
    expect(screen.queryByText('First Person')).toBeNull();
    expect(screen.queryByTestId('author-images-grid')).toBeNull();

    // Second fetch resolves to 404 — error alert appears.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load artist/i);
    });
    errSpy.mockRestore();
  });

  it('shows an inline error message when the request fails (e.g. 404)', async () => {
    globalThis.fetch = mockFetch({ error: 'not found' }, 404) as unknown as typeof fetch;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AuthorDetail
        handle="@nope"
        onBack={() => {}}
        onOpenImage={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load artist/i);
    });
    errSpy.mockRestore();
  });
});
