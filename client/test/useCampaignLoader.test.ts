/**
 * Unit tests for useCampaignLoader hook (fringematrix5-g0q).
 *
 * Covers async paths not exercised by the existing source-guard and state-machine
 * tests in selectCampaign-cache-hit.test.js and imageCache-empty-array.test.js:
 *
 *   1. Normal load — fetch returns images → progress advances → currentImages set.
 *   2. Empty response — fetch returns [] → currentImages = [] → no error.
 *   3. Network error — fetch rejects → campaignLoadError = true.
 *   4. Abort mid-load — abort before fetch resolves → no error, no state update.
 *   5. Abort during preload — abort after fetch resolves → no error, loading stays.
 *   6. Per-image timeout — source-level guard verifying IMAGE_PRELOAD_TIMEOUT_MS
 *      and settle(true) logic (fake timers interact poorly with act(); behavioral
 *      coverage is deferred to a future integration test).
 *   7. Progress sequencing — campaignLoadProgress / campaignLoadTotal track correctly.
 *   8. onImageCountKnown callback — fires once with the correct count.
 *   9. selectCampaign cache-hit — no extra fetch on re-navigation.
 *
 * Strategy:
 *   - Mock `fetch` via vi.spyOn(global, 'fetch').
 *   - Mock Image constructor to auto-fire onload/onerror in the next microtask
 *     when src is set — this mirrors real browser behavior and lets act(async)
 *     resolve without timing out.
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
// Image mock — auto-fires on src assignment
// ---------------------------------------------------------------------------

type ImageFireType = 'load' | 'error' | 'timeout';

/**
 * Per-URL decision about what event to fire.
 * Tests set entries in this map before running.  Default is 'load'.
 */
let imageFireMap: Map<string, ImageFireType> = new Map();

/**
 * Install a mock Image constructor that fires onload/onerror asynchronously
 * (one microtask after src is assigned) according to imageFireMap.
 * Returns a restore function.
 */
function installMockImage(
  defaultFire: ImageFireType = 'load',
): () => void {
  const OriginalImage = global.Image;

  function FakeImage(this: {
    onload: (() => void) | null;
    onerror: (() => void) | null;
  }) {
    let _src = '';
    this.onload = null;
    this.onerror = null;
    const self = this;
    Object.defineProperty(this, 'src', {
      configurable: true,
      get: () => _src,
      set: (val: string) => {
        _src = val;
        if (!val) return;
        const fireType = imageFireMap.get(val) ?? defaultFire;
        if (fireType === 'timeout') return; // simulate hung image — never fires
        Promise.resolve().then(() => {
          if (fireType === 'load') self.onload?.();
          else self.onerror?.();
        });
      },
    });
  }

  global.Image = FakeImage as unknown as typeof Image;

  return () => {
    global.Image = OriginalImage;
    imageFireMap = new Map();
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.spyOn>;
let restoreImage: (() => void) | null = null;

beforeEach(() => {
  imageFireMap = new Map();
  fetchSpy = vi.spyOn(global, 'fetch');
  restoreImage = installMockImage('load'); // default: all images load successfully
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchSpy.mockRestore();
  restoreImage?.();
  restoreImage = null;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Normal load
// ---------------------------------------------------------------------------

describe('useCampaignLoader — normal load', () => {
  it('sets isCampaignLoading=false after all images preload', async () => {
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

  it('sets currentImages to fully-loaded entries', async () => {
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
    expect(result.current.currentImages[0].loadedSrc).toBe('https://cdn.example.com/a.jpg');
    expect(result.current.currentImages[1].isLoading).toBe(false);
    expect(result.current.currentImages[1].loadedSrc).toBe('https://cdn.example.com/b.jpg');
  });

  it('caches the fully-loaded images under the campaign id', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep1', controller.signal);
    });

    expect('ep1' in result.current.imageCache).toBe(true);
    expect(result.current.imageCache['ep1']).toHaveLength(1);
  });

  it('does not set campaignLoadError when all images load successfully', async () => {
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

  it('sets campaignLoadTotal=0 for an empty response', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-empty', controller.signal);
    });

    expect(result.current.campaignLoadTotal).toBe(0);
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

    expect('ep-empty' in result.current.imageCache).toBe(false);
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
});

// ---------------------------------------------------------------------------
// 5. Abort during preload (after fetch resolves)
// ---------------------------------------------------------------------------

describe('useCampaignLoader — abort during image preload', () => {
  it('does not set campaignLoadError when aborted during preload', async () => {
    // Use 'timeout' fire type so images never resolve on their own — we abort.
    imageFireMap.set('https://cdn.example.com/a.jpg', 'timeout');
    imageFireMap.set('https://cdn.example.com/b.jpg', 'timeout');

    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
      { fileName: 'b.jpg', src: 'https://cdn.example.com/b.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      const p = result.current.loadCampaignImages('ep-abort', controller.signal);
      // Abort after fetch resolves (next microtask)
      await Promise.resolve();
      await Promise.resolve();
      controller.abort();
      await p;
    });

    // Abort is not an error — campaignLoadError must remain false.
    expect(result.current.campaignLoadError).toBe(false);
    // The hook's finally block: `if (!signal.aborted) setIsCampaignLoading(false)`.
    // Because the signal is aborted, isCampaignLoading stays true — the caller
    // (selectCampaign) is responsible for resetting it when it starts a new load.
    expect(result.current.isCampaignLoading).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Per-image timeout — source-level guard
// ---------------------------------------------------------------------------

describe('useCampaignLoader — per-image timeout (source guard)', () => {
  it('has a positive IMAGE_PRELOAD_TIMEOUT_MS constant in the source', () => {
    // The preloadCampaignImages function must have a setTimeout that
    // limits hung images.  We verify the constant exists and is reasonable
    // without running fake timers (which interact poorly with act()).
    const fs = require('fs');
    const path = require('path');
    const src: string = fs.readFileSync(
      path.resolve(__dirname, '../src/hooks/useCampaignLoader.ts'),
      'utf-8',
    );
    const match = src.match(/IMAGE_PRELOAD_TIMEOUT_MS\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const timeoutMs = parseInt(match![1], 10);
    expect(timeoutMs).toBeGreaterThan(0);
  });

  it('preloadCampaignImages uses setTimeout with IMAGE_PRELOAD_TIMEOUT_MS', () => {
    const fs = require('fs');
    const path = require('path');
    const src: string = fs.readFileSync(
      path.resolve(__dirname, '../src/hooks/useCampaignLoader.ts'),
      'utf-8',
    );
    // The timeout must call settle(true) to mark the image as errored.
    expect(src).toMatch(/setTimeout\(.*?settle\(true\).*?IMAGE_PRELOAD_TIMEOUT_MS/s);
  });

  it('settle(true) sets hasError=true in preloadCampaignImages', () => {
    const fs = require('fs');
    const path = require('path');
    const src: string = fs.readFileSync(
      path.resolve(__dirname, '../src/hooks/useCampaignLoader.ts'),
      'utf-8',
    );
    // The settle function must set hasError when errored=true.
    expect(src).toMatch(/if \(errored\) hasError = true/);
  });
});

// ---------------------------------------------------------------------------
// 7. Progress tracking
// ---------------------------------------------------------------------------

describe('useCampaignLoader — progress tracking', () => {
  it('sets campaignLoadTotal to the image count after the API responds', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
      { fileName: 'b.jpg', src: 'https://cdn.example.com/b.jpg' },
      { fileName: 'c.jpg', src: 'https://cdn.example.com/c.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-progress', controller.signal);
    });

    expect(result.current.campaignLoadTotal).toBe(3);
  });

  it('campaignLoadProgress equals total after all images load', async () => {
    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'a.jpg', src: 'https://cdn.example.com/a.jpg' },
      { fileName: 'b.jpg', src: 'https://cdn.example.com/b.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-progress', controller.signal);
    });

    expect(result.current.campaignLoadProgress).toBe(2);
    expect(result.current.campaignLoadTotal).toBe(2);
  });

  it('sets campaignLoadError=true when one image errors during preload', async () => {
    imageFireMap.set('https://cdn.example.com/bad.jpg', 'error');

    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'ok.jpg', src: 'https://cdn.example.com/ok.jpg' },
      { fileName: 'bad.jpg', src: 'https://cdn.example.com/bad.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-err-img', controller.signal);
    });

    expect(result.current.campaignLoadError).toBe(true);
    expect(result.current.isCampaignLoading).toBe(false);
  });

  it('counts errored images toward progress (partial error scenario)', async () => {
    imageFireMap.set('https://cdn.example.com/bad.jpg', 'error');

    fetchSpy.mockResolvedValueOnce(makeImagesResponse([
      { fileName: 'ok.jpg', src: 'https://cdn.example.com/ok.jpg' },
      { fileName: 'bad.jpg', src: 'https://cdn.example.com/bad.jpg' },
      { fileName: 'ok2.jpg', src: 'https://cdn.example.com/ok2.jpg' },
    ]));

    const { result } = renderHook(() => useCampaignLoader());
    const controller = new AbortController();

    await act(async () => {
      await result.current.loadCampaignImages('ep-partial', controller.signal);
    });

    // All 3 counted (error is still "processed")
    expect(result.current.campaignLoadProgress).toBe(3);
    expect(result.current.campaignLoadTotal).toBe(3);
    // currentImages still populated — the hook sets them after preload
    expect(result.current.currentImages).toHaveLength(3);
    expect(result.current.campaignLoadError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. onImageCountKnown callback
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
// 9. selectCampaign cache-hit integration
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

    expect('ep1' in result.current.imageCache).toBe(true);
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
