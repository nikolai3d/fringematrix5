/**
 * Test surface: confirms the bundled gallery thumbnail config is well-formed
 * and that the resolveGallery resolver handles invalid, out-of-range, and
 * partial inputs by falling back to documented defaults.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  GALLERY_THUMBNAIL_SIZES,
  GALLERY_DEFAULT_SIZE_INDEX,
  clampThumbnailSizeIndex,
  resolveGallery,
} from '../src/config/gallery';

describe('GALLERY_THUMBNAIL_SIZES (resolved from config.yaml)', () => {
  it('is a non-empty array of positive finite numbers', () => {
    expect(Array.isArray(GALLERY_THUMBNAIL_SIZES)).toBe(true);
    expect(GALLERY_THUMBNAIL_SIZES.length).toBeGreaterThan(0);
    for (const size of GALLERY_THUMBNAIL_SIZES) {
      expect(typeof size).toBe('number');
      expect(Number.isFinite(size)).toBe(true);
      expect(size).toBeGreaterThan(0);
    }
  });

  it('GALLERY_DEFAULT_SIZE_INDEX is an in-range integer', () => {
    expect(Number.isInteger(GALLERY_DEFAULT_SIZE_INDEX)).toBe(true);
    expect(GALLERY_DEFAULT_SIZE_INDEX).toBeGreaterThanOrEqual(0);
    expect(GALLERY_DEFAULT_SIZE_INDEX).toBeLessThan(GALLERY_THUMBNAIL_SIZES.length);
  });

  it('is ordered smallest to largest (matches config.yaml contract)', () => {
    for (let i = 1; i < GALLERY_THUMBNAIL_SIZES.length; i++) {
      expect(GALLERY_THUMBNAIL_SIZES[i]).toBeGreaterThan(GALLERY_THUMBNAIL_SIZES[i - 1]);
    }
  });
});

describe('resolveGallery — valid inputs', () => {
  it('passes a valid 4-size config through unchanged', () => {
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      defaultThumbnailSizeIndex: 2,
    });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(result.defaultThumbnailSizeIndex).toBe(2);
  });

  it('accepts boundary index values (0 and sizes.length - 1)', () => {
    const result0 = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      defaultThumbnailSizeIndex: 0,
    });
    expect(result0.defaultThumbnailSizeIndex).toBe(0);

    const resultMax = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      defaultThumbnailSizeIndex: 3,
    });
    expect(resultMax.defaultThumbnailSizeIndex).toBe(3);
  });
});

describe('resolveGallery — fallback to defaults', () => {
  it('returns defaults when called with undefined (block missing from config)', () => {
    const result = resolveGallery(undefined);
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(result.defaultThumbnailSizeIndex).toBe(1);
  });

  it('returns defaults when called with an empty object', () => {
    const result = resolveGallery({});
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(result.defaultThumbnailSizeIndex).toBe(1);
  });

  it('treats null fields the same as undefined (YAML may emit null for blank keys)', () => {
    const result = resolveGallery({
      thumbnailSizes: null as unknown as number[],
      defaultThumbnailSizeIndex: null as unknown as number,
    });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(result.defaultThumbnailSizeIndex).toBe(1);
  });

  it('falls back per-field when only thumbnailSizes is set', () => {
    const result = resolveGallery({ thumbnailSizes: [100, 200] });
    expect(result.thumbnailSizes).toEqual([100, 200]);
    // Default index 1 is in range for length 2
    expect(result.defaultThumbnailSizeIndex).toBe(1);
  });
});

describe('resolveGallery — invalid thumbnailSizes', () => {
  it('falls back to defaults and warns when thumbnailSizes is an empty array', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({ thumbnailSizes: [] });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailSizes'));
    warnSpy.mockRestore();
  });

  it('falls back to defaults and warns when an entry is non-numeric', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 'big' as unknown as number, 340],
    });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailSizes'));
    warnSpy.mockRestore();
  });

  it('falls back to defaults and warns when an entry is negative', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({ thumbnailSizes: [120, -50, 340] });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailSizes'));
    warnSpy.mockRestore();
  });

  it('falls back to defaults and warns when an entry is zero', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({ thumbnailSizes: [0, 220, 340] });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailSizes'));
    warnSpy.mockRestore();
  });

  it('falls back to defaults and warns when an entry is NaN', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({ thumbnailSizes: [120, NaN, 340] });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailSizes'));
    warnSpy.mockRestore();
  });

  it('falls back to defaults and warns when an entry is Infinity', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({ thumbnailSizes: [120, Infinity, 340] });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailSizes'));
    warnSpy.mockRestore();
  });

  it('falls back to defaults and warns when thumbnailSizes is not an array', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: 'big' as unknown as number[],
    });
    expect(result.thumbnailSizes).toEqual([120, 220, 340, 480]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailSizes'));
    warnSpy.mockRestore();
  });
});

describe('resolveGallery — invalid defaultThumbnailSizeIndex', () => {
  it('falls back to default index and warns when out of range (too high)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      defaultThumbnailSizeIndex: 99,
    });
    expect(result.defaultThumbnailSizeIndex).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('defaultThumbnailSizeIndex'));
    warnSpy.mockRestore();
  });

  it('falls back to default index and warns when negative', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      defaultThumbnailSizeIndex: -1,
    });
    expect(result.defaultThumbnailSizeIndex).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('defaultThumbnailSizeIndex'));
    warnSpy.mockRestore();
  });

  it('falls back to default index and warns when non-integer', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      defaultThumbnailSizeIndex: 1.5,
    });
    expect(result.defaultThumbnailSizeIndex).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('defaultThumbnailSizeIndex'));
    warnSpy.mockRestore();
  });

  it('falls back to default index and warns when non-numeric', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      defaultThumbnailSizeIndex: 'first' as unknown as number,
    });
    expect(result.defaultThumbnailSizeIndex).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('defaultThumbnailSizeIndex'));
    warnSpy.mockRestore();
  });

  it('clamps the fallback when sizes is shorter than the default index', () => {
    // sizes length 1 means index 1 is out of range; resolver must clamp to 0
    const result = resolveGallery({
      thumbnailSizes: [200],
      defaultThumbnailSizeIndex: undefined,
    });
    expect(result.thumbnailSizes).toEqual([200]);
    expect(result.defaultThumbnailSizeIndex).toBe(0);
  });
});

describe('clampThumbnailSizeIndex', () => {
  // Only the non-empty invariant is guaranteed by resolveThumbnailSizes, so
  // boundary indices 0 and maxIndex are the only universally in-range values.
  const maxIndex = GALLERY_THUMBNAIL_SIZES.length - 1;

  it('returns boundary values 0 and maxIndex unchanged', () => {
    expect(clampThumbnailSizeIndex(0)).toBe(0);
    expect(clampThumbnailSizeIndex(maxIndex)).toBe(maxIndex);
  });

  it('clamps values above the upper bound to maxIndex', () => {
    expect(clampThumbnailSizeIndex(maxIndex + 1)).toBe(maxIndex);
    expect(clampThumbnailSizeIndex(999)).toBe(maxIndex);
  });

  it('clamps negative values to 0', () => {
    expect(clampThumbnailSizeIndex(-1)).toBe(0);
    expect(clampThumbnailSizeIndex(-100)).toBe(0);
  });
});
