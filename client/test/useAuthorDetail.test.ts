import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthorDetail, clearAuthorDetailCache } from '../src/hooks/useAuthorDetail';

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
  ],
};

const SAMPLE_DETAIL_B = {
  author: {
    handle: '@OtherArtist',
    name: 'Other Artist',
    twitterUrl: null,
    alternateHandles: [],
    roles: ['artist'],
  },
  images: [],
};

function mockFetch(responseBody: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  clearAuthorDetailCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('useAuthorDetail', () => {
  it('fetches /api/authors/:handle and returns data on success', async () => {
    const fetchSpy = mockFetch(SAMPLE_DETAIL);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { result } = renderHook(() => useAuthorDetail('@Zort70'));

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data?.author.name).toBe('Sarah Proost');
    expect(result.current.error).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/api/authors/%40Zort70');
  });

  it('fetches only once across two mounts for the same handle (cache hit on second mount)', async () => {
    // First mount: fetches from network.
    const fetchSpy = mockFetch(SAMPLE_DETAIL);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { result: result1, unmount } = renderHook(() => useAuthorDetail('@Zort70'));
    await waitFor(() => {
      expect(result1.current.data).not.toBeNull();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    unmount();

    // Second mount: should hit cache, no additional fetch.
    const { result: result2 } = renderHook(() => useAuthorDetail('@Zort70'));

    // Data is available synchronously on mount (from cache initializer).
    expect(result2.current.data?.author.name).toBe('Sarah Proost');
    expect(result2.current.error).toBeNull();

    // Give any potential async fetch time to run — it should not.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fetches exactly 2 times when navigating A → B → A (A served from cache on revisit)', async () => {
    let callCount = 0;
    const fetchSpy = vi.fn(async (url: string) => {
      callCount += 1;
      const body = (url as string).includes('OtherArtist') ? SAMPLE_DETAIL_B : SAMPLE_DETAIL;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    // Visit A (@Zort70) — first visit, fetches from network.
    const { result, rerender } = renderHook(
      ({ handle }: { handle: string }) => useAuthorDetail(handle),
      { initialProps: { handle: '@Zort70' } },
    );
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    // Navigate to B (@OtherArtist) — second fetch.
    rerender({ handle: '@OtherArtist' });
    await waitFor(() => {
      expect(result.current.data?.author.handle).toBe('@OtherArtist');
    });

    // Navigate back to A — served from cache, no new fetch.
    rerender({ handle: '@Zort70' });
    expect(result.current.data?.author.name).toBe('Sarah Proost');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // 2 total fetches: 1 for @Zort70 (first visit), 1 for @OtherArtist.
    // @Zort70 revisit hits cache — no third fetch.
    expect(callCount).toBe(2);
  });

  it('returns error state on 404', async () => {
    globalThis.fetch = mockFetch({ error: 'not found' }, 404) as unknown as typeof fetch;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuthorDetail('@missing'));
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error).toMatch(/failed to load artist/i);
    expect(result.current.data).toBeNull();
    errSpy.mockRestore();
  });
});
