/**
 * Unit tests for useCampaignLoader hook.
 *
 * The hook no longer preloads images before rendering — it builds the final
 * ImageData[] in a single pass as soon as the image *list* arrives, and the
 * browser streams thumbnails in natively via <img loading="lazy">. These tests
 * cover the list-fetch async paths:
 *
 *   1. Normal load — fetch returns images → currentImages set to ready entries.
 *   2. Empty response — fetch returns [] → currentImages = [] → not cached.
 *   3. Network error — fetch rejects → campaignLoadError = true.
 *   4. Abort before fetch resolves → no error, no state update, no count callback.
 *   5. onImageCountKnown callback — fires once with the correct count.
 *   6. selectCampaign cache-hit — no extra fetch on re-navigation.
 *   7. campaignId stamping — every entry carries the active campaign id.
 *   8. Blob CDN preconnect — a <link rel="preconnect"> is injected for the
 *      first image's origin.
 *
 * Strategy: mock `fetch` via vi.spyOn(global, 'fetch'). No Image mock is needed
 * anymore since the hook does not construct Image objects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCampaignLoader } from '../src/hooks/useCampaignLoader';

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function makeImagesResponse(images: Array<{ fileName: string; src: string }>) {
  return {
    ok: true,
    headers: { get: (_: string) => 'application/json' },
    json: async () => ({ images }),
    text: async () => JSON.stringify({ images }),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(global, 'fetch');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchSpy.mockRestore();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Normal load
// ---------------------------------------------------------------------------

describe('useCampaignLoader — normal load', () => {
  it('sets isCampaignLoading=false after the list arrives', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
      { fileName: 'b.jpg', src: 'https://cdn.example.com/b.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep1', controller.signal);
    });

    expect(result.current.isCampaignLoading).toBe(false);
  });

  it('sets currentImages to ready entries (src populated, isLoading false)', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
      { fileName: 'b.jpg', src: 'https://cdn.example.com/b.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep1', controller.signal);
    });

    expect(result.current.currentImages).toHaveLength(2);
    expect(result.current.currentImages[0].isLoading).toBe(false);
    expect(result.current.currentImages[0].src).toBe('https://cdn.example.com/a.jpg');
    expect(result.current.currentImages[0].loadedSrc).toBe('https://cdn.example.com/a.jpg');
    expect(result.current.currentImages[1].isLoading).toBe(false);
    expect(result.current.currentImages[1].src).toBe('https://cdn.example.com/b.jpg');
    expect(result.current.currentImages[1].loadedSrc).toBe('https://cdn.example.com/b.jpg');
  });

  it('caches the images under the campaign id', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep1', controller.signal);
    });

    const fetchCallsAfterFirstLoad = fetchSpy.mock.calls.length;

    // Second load of same campaign via selectCampaign — should hit cache, no new fetch
    await act(async () => {
      await result.current.selectCampaign('ep1', () => {});
    });

    expect(fetchSpy.mock.calls.length).toBe(fetchCallsAfterFirstLoad);
    expect(result.current.currentImages).toHaveLength(1);
  });

  it('does not set campaignLoadError on a successful load', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep1', controller.signal);
    });

    expect(result.current.campaignLoadError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Empty response
// ---------------------------------------------------------------------------

describe('useCampaignLoader — empty image response', () => {
  it('sets currentImages to [] when the API returns zero images', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-empty', controller.signal);
    });

    expect(result.current.currentImages).toEqual([]);
  });

  it('does not set campaignLoadError for an empty response', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-empty', controller.signal);
    });

    expect(result.current.campaignLoadError).toBe(false);
  });

  it('sets isCampaignLoading=false for an empty response', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-empty', controller.signal);
    });

    expect(result.current.isCampaignLoading).toBe(false);
  });

  it('does NOT cache the campaign when image list is empty (early return before setImageCache)', async () => {
    // The hook returns early when campaignImages.length === 0, before calling
    // setImageCache.  Empty campaigns must not pollute the cache with [].
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-empty', controller.signal);
    });

    const fetchCallsAfterFirstLoad = fetchSpy.mock.calls.length;

    // Second visit — empty was not cached, so a new fetch MUST be triggered
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([]));
    await act(async () => {
      await result.current.selectCampaign('ep-empty', () => {});
    });

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(fetchCallsAfterFirstLoad);
  });
});

// ---------------------------------------------------------------------------
// 3. Network error
// ---------------------------------------------------------------------------

describe('useCampaignLoader — network error', () => {
  it('sets campaignLoadError=true when fetch rejects', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-err', controller.signal);
    });

    expect(result.current.campaignLoadError).toBe(true);
  });

  it('sets isCampaignLoading=false after a network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-err', controller.signal);
    });

    expect(result.current.isCampaignLoading).toBe(false);
  });

  it('sets currentImages=[] after a network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-err', controller.signal);
    });

    expect(result.current.currentImages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Abort before fetch resolves
// ---------------------------------------------------------------------------

describe('useCampaignLoader — abort before fetch resolves', () => {
  it('does not set campaignLoadError when aborted via AbortError', async () => {
    fetchSpy.mockImplementationOnce(
      (_url: string, opts?: RequestInit) =>
        new Promise<Response>((_resolve, _reject) => {
          opts?.signal?.addEventListener('abort', () => {
            _reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      const p = result.current.loadCampaignImages('ep-abort', controller.signal);
      controller.abort();
      await p.catch(() => {});
    });

    expect(result.current.campaignLoadError).toBe(false);
  });

  it('does not update currentImages when aborted before fetch resolves', async () => {
    fetchSpy.mockImplementationOnce(
      (_url: string, opts?: RequestInit) =>
        new Promise<Response>((_resolve, _reject) => {
          opts?.signal?.addEventListener('abort', () => {
            _reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      const p = result.current.loadCampaignImages('ep-abort', controller.signal);
      controller.abort();
      await p.catch(() => {});
    });

    expect(result.current.currentImages).toEqual([]);
  });

  // Covers the abort-after-fetch-resolves branch: the fetch succeeds with a
  // non-empty list, but the signal is aborted right as the response is read
  // (we abort inside json(), before the post-await `if (signal.aborted) return`
  // guard runs). Images must NOT be committed and no error must be set.
  it('does not commit images when aborted exactly after fetch resolves', async () => {
    const controller = new AbortController();
    const images = [{ fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' }];

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      headers: { get: (_: string) => 'application/json' },
      // Abort right as the body is parsed — fetchJSON awaits json(), so by the
      // time loadCampaignImages reaches its post-await abort guard the signal
      // is already aborted.
      json: async () => {
        controller.abort();
        return { images };
      },
      text: async () => JSON.stringify({ images }),
    } as unknown as Response);

    const { result } = renderHook(() => useCampaignLoader());

    await act(async () => {
      await result.current.loadCampaignImages('ep-abort-after', controller.signal);
    });

    expect(result.current.currentImages).toEqual([]);
    expect(result.current.campaignLoadError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. onImageCountKnown callback
// ---------------------------------------------------------------------------

describe('useCampaignLoader — onImageCountKnown callback', () => {
  it('calls onImageCountKnown with the correct image count', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
      { fileName: 'b.jpg', src: 'https://cdn.example.com/b.jpg' },
      { fileName: 'c.jpg', src: 'https://cdn.example.com/c.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();
    const onCountKnown = vi.fn();

    await act(async () => {
      await result.current.loadCampaignImages('ep1', controller.signal, onCountKnown);
    });

    expect(onCountKnown).toHaveBeenCalledOnce();
    expect(onCountKnown).toHaveBeenCalledWith(3);
  });

  it('calls onImageCountKnown with 0 for an empty response', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();
    const onCountKnown = vi.fn();

    await act(async () => {
      await result.current.loadCampaignImages('ep-empty', controller.signal, onCountKnown);
    });

    expect(onCountKnown).toHaveBeenCalledOnce();
    expect(onCountKnown).toHaveBeenCalledWith(0);
  });

  it('does not call onImageCountKnown when aborted before fetch resolves', async () => {
    fetchSpy.mockImplementationOnce(
      (_url: string, opts?: RequestInit) =>
        new Promise<Response>((_resolve, _reject) => {
          opts?.signal?.addEventListener('abort', () => {
            _reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();
    const onCountKnown = vi.fn();

    await act(async () => {
      const p = result.current.loadCampaignImages(
        'ep-abort',
        controller.signal,
        onCountKnown,
      );
      controller.abort();
      await p.catch(() => {});
    });

    expect(onCountKnown).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. selectCampaign cache-hit integration
// ---------------------------------------------------------------------------

describe('useCampaignLoader — selectCampaign cache-hit (renderHook)', () => {
  it('serves images from cache without calling fetch a second time', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());

    // First visit — triggers network load
    await act(async () => {
      await result.current.selectCampaign('ep1', () => {});
    });

    const fetchCallsAfterFirstLoad = fetchSpy.mock.calls.length;

    // Second visit — should hit cache, no fetch
    await act(async () => {
      await result.current.selectCampaign('ep1', () => {});
    });

    expect(fetchSpy.mock.calls.length).toBe(fetchCallsAfterFirstLoad);
    expect(result.current.currentImages).toHaveLength(1);
  });

  it('resets error state when navigating back to a cached campaign', async () => {
    // ep1 succeeds
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
    ]));
    // ep2 fails
    fetchSpy.mockRejectedValueOnce(new Error('ep2 failed'));

    const { result } = renderHook(() => useCampaignLoader());

    // Load ep1 into cache
    await act(async () => {
      await result.current.selectCampaign('ep1', () => {});
    });

    // Load ep2 — triggers error
    await act(async () => {
      await result.current.selectCampaign('ep2', () => {});
    });

    expect(result.current.campaignLoadError).toBe(true);

    // Navigate back to ep1 (cached) — error must be cleared
    await act(async () => {
      await result.current.selectCampaign('ep1', () => {});
    });

    expect(result.current.campaignLoadError).toBe(false);
    expect(result.current.isCampaignLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. campaignId stamping
// ---------------------------------------------------------------------------

describe('useCampaignLoader — campaignId stamping', () => {
  it('stamps the loading campaign id onto every ImageData', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
      { fileName: 'b.jpg', src: 'https://cdn.example.com/b.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('S04E11', controller.signal);
    });

    expect(result.current.currentImages).toHaveLength(2);
    expect(result.current.currentImages[0].campaignId).toBe('S04E11');
    expect(result.current.currentImages[1].campaignId).toBe('S04E11');
  });
});

// ---------------------------------------------------------------------------
// 8. Blob CDN preconnect injection
// ---------------------------------------------------------------------------

describe('useCampaignLoader — Blob CDN preconnect', () => {
  it('injects a <link rel="preconnect"> for the first image origin', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://store123.public.blob.vercel-storage.com/a.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-preconnect', controller.signal);
    });

    const link = document.head.querySelector(
      'link[rel="preconnect"][href="https://store123.public.blob.vercel-storage.com"]',
    );
    expect(link).not.toBeNull();
    expect(link?.getAttribute('crossorigin')).toBe('anonymous');
  });

  // NOTE: preconnectedOrigins is a module-scoped Set persisting across tests,
  // so these use origins distinct from each other and from the test above to
  // avoid cross-test interference.
  it('injects exactly one preconnect link for two campaigns sharing an origin', async () => {
    const origin = 'https://dedup-store.public.blob.vercel-storage.com';
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: `${origin}/a.jpg` },
    ]));
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'b.jpg', src: `${origin}/b.jpg` },
    ]));

    const { result } = renderHook(() => useCampaignLoader());

    await act(async () => {
      await result.current.loadCampaignImages('ep-dedup-1', new AbortController().signal);
    });
    await act(async () => {
      await result.current.loadCampaignImages('ep-dedup-2', new AbortController().signal);
    });

    const links = document.head.querySelectorAll(
      `link[rel="preconnect"][href="${origin}"]`,
    );
    expect(links).toHaveLength(1);
  });

  it('injects no preconnect link and does not throw for a malformed first image URL', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'not-a-valid-url' },
    ]));

    const before = document.head.querySelectorAll('link[rel="preconnect"]').length;

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-malformed', controller.signal);
    });

    // The malformed URL is swallowed: no error, images still committed.
    expect(result.current.campaignLoadError).toBe(false);
    expect(result.current.currentImages).toHaveLength(1);

    const after = document.head.querySelectorAll('link[rel="preconnect"]').length;
    expect(after).toBe(before);
  });
});
