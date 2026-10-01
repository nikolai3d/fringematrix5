import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { preloadImage, preloadNeighbors, __resetPreloadCacheForTests } from '../src/utils/preloadImage';

// Records every src assigned to an Image() so tests can assert what was warmed.
let requested: string[];
const OriginalImage = globalThis.Image;

beforeEach(() => {
  __resetPreloadCacheForTests();
  requested = [];
  class FakeImage {
    decoding = '';
    set src(value: string) { requested.push(value); }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;
});

afterEach(() => {
  globalThis.Image = OriginalImage;
});

describe('preloadImage', () => {
  it('requests the image once per URL', () => {
    preloadImage('https://cdn/a.jpg');
    preloadImage('https://cdn/a.jpg');
    preloadImage('https://cdn/b.jpg');
    expect(requested).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });

  it('ignores empty, null and undefined sources', () => {
    preloadImage('');
    preloadImage(null);
    preloadImage(undefined);
    expect(requested).toEqual([]);
  });

  it('forgets the oldest URL once 64 are tracked, so it can be re-requested', () => {
    for (let i = 0; i < 65; i++) preloadImage(`u${i}`);
    expect(requested).toHaveLength(65);
    preloadImage('u0'); // evicted by u64 → requested again
    preloadImage('u64'); // still tracked → skipped
    expect(requested).toHaveLength(66);
    expect(requested[65]).toBe('u0');
  });

  it('is a no-op when Image is unavailable (non-DOM environments)', () => {
    // @ts-expect-error simulate a runtime without Image
    globalThis.Image = undefined;
    expect(() => preloadImage('x')).not.toThrow();
  });
});

describe('preloadNeighbors', () => {
  const imgs = ['a', 'b', 'c', 'd', 'e'].map((s) => ({ src: s }));

  it('warms the next and previous image', () => {
    preloadNeighbors(imgs, 2);
    expect(requested).toEqual(['d', 'b']);
  });

  it('wraps around at both ends, matching circular lightbox navigation', () => {
    preloadNeighbors(imgs, 0);
    expect(requested).toEqual(['b', 'e']);
    __resetPreloadCacheForTests();
    requested = [];
    preloadNeighbors(imgs, 4);
    expect(requested).toEqual(['a', 'd']);
  });

  it('honours a larger radius without duplicating wrapped entries', () => {
    preloadNeighbors(imgs.slice(0, 3), 0, 2);
    // radius 2 over 3 images: +1=b, -1=c, +2=c (dup, skipped), -2=b (dup)
    expect(requested).toEqual(['b', 'c']);
  });

  it('does nothing for single-image lists or out-of-range indices', () => {
    preloadNeighbors([{ src: 'only' }], 0);
    preloadNeighbors(imgs, -1);
    preloadNeighbors(imgs, 5);
    expect(requested).toEqual([]);
  });

  it('skips neighbors without a src (still-loading placeholders)', () => {
    preloadNeighbors([{ src: 'a' }, { src: null }, { src: 'c' }], 0);
    expect(requested).toEqual(['c']);
  });
});

describe('preloadImage sets async decoding', () => {
  it('marks the preloader image decoding=async', () => {
    const created: Array<{ decoding: string }> = [];
    class SpyImage {
      decoding = '';
      constructor() { created.push(this); }
      set src(_v: string) { /* noop */ }
    }
    globalThis.Image = SpyImage as unknown as typeof Image;
    preloadImage('z');
    expect(created[0]?.decoding).toBe('async');
    vi.restoreAllMocks();
  });
});
