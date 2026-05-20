/**
 * Test surface: confirms the bundled gallery thumbnail config is well-formed
 * and that the resolveGallery resolver handles invalid, out-of-range, and
 * partial inputs by falling back to documented defaults.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  GALLERY_THUMBNAIL_SIZES,
  GALLERY_DEFAULT_SIZE_INDEX,
  GALLERY_THUMBNAIL_GAPS,
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

// =============================================================================
// GALLERY_THUMBNAIL_GAPS — bundled constant
// =============================================================================

describe('GALLERY_THUMBNAIL_GAPS (resolved from config.yaml)', () => {
  it('is a non-empty array of non-negative finite numbers', () => {
    expect(Array.isArray(GALLERY_THUMBNAIL_GAPS)).toBe(true);
    expect(GALLERY_THUMBNAIL_GAPS.length).toBeGreaterThan(0);
    for (const gap of GALLERY_THUMBNAIL_GAPS) {
      expect(typeof gap).toBe('number');
      expect(Number.isFinite(gap)).toBe(true);
      expect(gap).toBeGreaterThanOrEqual(0);
    }
  });

  it('has the same length as GALLERY_THUMBNAIL_SIZES', () => {
    expect(GALLERY_THUMBNAIL_GAPS.length).toBe(GALLERY_THUMBNAIL_SIZES.length);
  });

  it('is ordered from smallest to largest (gap decreases as scale decreases)', () => {
    for (let i = 1; i < GALLERY_THUMBNAIL_GAPS.length; i++) {
      expect(GALLERY_THUMBNAIL_GAPS[i]).toBeGreaterThanOrEqual(GALLERY_THUMBNAIL_GAPS[i - 1]);
    }
  });

  it('gap at smallest scale is strictly less than gap at largest scale', () => {
    const first = GALLERY_THUMBNAIL_GAPS[0];
    const last = GALLERY_THUMBNAIL_GAPS[GALLERY_THUMBNAIL_GAPS.length - 1];
    expect(last).toBeGreaterThan(first);
  });
});

// =============================================================================
// resolveGallery — thumbnailGaps
// =============================================================================

describe('resolveGallery — thumbnailGaps valid inputs', () => {
  it('passes a matching gap array through unchanged', () => {
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [4, 8, 12, 14],
    });
    expect(result.thumbnailGaps).toEqual([4, 8, 12, 14]);
  });

  it('accepts zero as a valid gap value', () => {
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [0, 4, 8, 12],
    });
    expect(result.thumbnailGaps).toEqual([0, 4, 8, 12]);
  });

  it('gap array length matches thumbnailSizes length when both are custom', () => {
    const result = resolveGallery({
      thumbnailSizes: [100, 200, 300],
      thumbnailGaps: [2, 6, 10],
    });
    expect(result.thumbnailGaps.length).toBe(result.thumbnailSizes.length);
  });
});

describe('resolveGallery — thumbnailGaps fallback behaviour', () => {
  it('returns default gaps when thumbnailGaps is omitted', () => {
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
    });
    expect(result.thumbnailGaps.length).toBe(4);
    for (const gap of result.thumbnailGaps) {
      expect(gap).toBeGreaterThanOrEqual(0);
    }
  });

  it('falls back and warns when gap array length mismatches thumbnailSizes', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [4, 8],   // wrong length
    });
    expect(result.thumbnailGaps.length).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailGaps'));
    warnSpy.mockRestore();
  });

  it('falls back and warns when a gap entry is negative', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [4, -2, 12, 14],
    });
    expect(result.thumbnailGaps.length).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailGaps'));
    warnSpy.mockRestore();
  });

  it('falls back and warns when a gap entry is non-numeric', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [4, 'wide' as unknown as number, 12, 14],
    });
    expect(result.thumbnailGaps.length).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailGaps'));
    warnSpy.mockRestore();
  });

  it('falls back and warns when thumbnailGaps is not an array', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: 'big' as unknown as number[],
    });
    expect(result.thumbnailGaps.length).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnailGaps'));
    warnSpy.mockRestore();
  });
});

// =============================================================================
// Gap shrinks as scale decreases — core acceptance criterion
// =============================================================================

describe('resolveGallery — gap decreases as scale index decreases', () => {
  it('each successive gap is >= the previous (monotone non-decreasing)', () => {
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [4, 8, 12, 14],
    });
    for (let i = 1; i < result.thumbnailGaps.length; i++) {
      expect(result.thumbnailGaps[i]).toBeGreaterThanOrEqual(result.thumbnailGaps[i - 1]);
    }
  });

  it('gap at smallest scale is strictly less than gap at largest scale', () => {
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [4, 8, 12, 14],
    });
    expect(result.thumbnailGaps[0]).toBeLessThan(
      result.thumbnailGaps[result.thumbnailGaps.length - 1],
    );
  });

  // Ordering is NOT enforced by the resolver — a reversed array passes
  // validation because every entry is a non-negative finite number. The
  // YAML doc says "should be ordered" (advisory, not mandatory). This test
  // documents that behavior explicitly so any future decision to enforce
  // ordering would require updating it.
  it('does NOT reject or warn for a reversed (non-monotone) gap array — ordering is advisory', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveGallery({
      thumbnailSizes: [120, 220, 340, 480],
      thumbnailGaps: [14, 12, 8, 4],   // intentionally reversed
    });
    // The resolver accepts the reversed array as-is (no warn, returned unchanged)
    expect(result.thumbnailGaps).toEqual([14, 12, 8, 4]);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
