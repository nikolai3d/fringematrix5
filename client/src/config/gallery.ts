/**
 * Gallery Configuration
 *
 * Loads gallery thumbnail settings from client/config.yaml under the
 * `gallery` key. Sizes are in DEVICE pixels (physical screen pixels);
 * retina-aware conversion to CSS px happens at consumer sites.
 *
 * Validates the array and default-index invariants so downstream code
 * can rely on a non-empty list and an in-range index.
 */

import type { AppConfig, GalleryConfig } from '../types/appConfig';
import configYaml from '../../config.yaml';

const config = configYaml as AppConfig;

const DEFAULT_THUMBNAIL_SIZES: readonly number[] = [120, 220, 340, 480];
const DEFAULT_SIZE_INDEX = 1;
/** Gap values (px) that pair 1-to-1 with the default thumbnail sizes, smallest to largest. */
const DEFAULT_THUMBNAIL_GAPS: readonly number[] = [4, 8, 12, 14];

export interface ResolvedGallery {
  thumbnailSizes: readonly number[];
  defaultThumbnailSizeIndex: number;
  thumbnailGaps: readonly number[];
}

function resolveThumbnailSizes(raw: GalleryConfig['thumbnailSizes']): readonly number[] {
  if (raw === undefined || raw === null) return DEFAULT_THUMBNAIL_SIZES;
  if (!Array.isArray(raw)) {
    console.warn(
      `Invalid gallery.thumbnailSizes: "${raw}" (must be an array). ` +
      `Using defaults [${DEFAULT_THUMBNAIL_SIZES.join(', ')}].`,
    );
    return DEFAULT_THUMBNAIL_SIZES;
  }
  if (raw.length === 0) {
    console.warn(
      `Invalid gallery.thumbnailSizes: empty array. ` +
      `Using defaults [${DEFAULT_THUMBNAIL_SIZES.join(', ')}].`,
    );
    return DEFAULT_THUMBNAIL_SIZES;
  }
  for (const value of raw) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      console.warn(
        `Invalid gallery.thumbnailSizes entry: "${value}" (must be a positive finite number). ` +
        `Using defaults [${DEFAULT_THUMBNAIL_SIZES.join(', ')}].`,
      );
      return DEFAULT_THUMBNAIL_SIZES;
    }
  }
  return raw;
}

function resolveDefaultIndex(
  raw: GalleryConfig['defaultThumbnailSizeIndex'],
  sizesLength: number,
): number {
  if (raw === undefined || raw === null) {
    return Math.min(DEFAULT_SIZE_INDEX, sizesLength - 1);
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw)) {
    console.warn(
      `Invalid gallery.defaultThumbnailSizeIndex: "${raw}" (must be an integer). ` +
      `Using default ${DEFAULT_SIZE_INDEX}.`,
    );
    return Math.min(DEFAULT_SIZE_INDEX, sizesLength - 1);
  }
  if (raw < 0 || raw > sizesLength - 1) {
    console.warn(
      `Invalid gallery.defaultThumbnailSizeIndex: ${raw} ` +
      `(must be between 0 and ${sizesLength - 1}). ` +
      `Using default ${DEFAULT_SIZE_INDEX}.`,
    );
    return Math.min(DEFAULT_SIZE_INDEX, sizesLength - 1);
  }
  return raw;
}

/**
 * Returns the best-effort default gap array for `sizesLength` size steps.
 * If DEFAULT_THUMBNAIL_GAPS already covers that many steps (i.e. length ≥
 * sizesLength) we slice it; otherwise we linearly interpolate between the
 * smallest and largest default gap values.
 */
function buildFallbackGaps(sizesLength: number): readonly number[] {
  if (sizesLength === 0) return [];
  if (sizesLength <= DEFAULT_THUMBNAIL_GAPS.length) {
    return DEFAULT_THUMBNAIL_GAPS.slice(0, sizesLength);
  }
  const min = DEFAULT_THUMBNAIL_GAPS[0];
  const max = DEFAULT_THUMBNAIL_GAPS[DEFAULT_THUMBNAIL_GAPS.length - 1];
  return Array.from({ length: sizesLength }, (_, i) =>
    Math.round(min + ((max - min) * i) / (sizesLength - 1)),
  );
}

/**
 * Resolves per-scale gap values.  The array must have the same length as
 * `thumbnailSizes` and every entry must be a non-negative finite number.
 * Any invalid input falls back to the defaults and emits a console.warn.
 */
function resolveGaps(
  raw: GalleryConfig['thumbnailGaps'],
  sizesLength: number,
): readonly number[] {
  const fallback = buildFallbackGaps(sizesLength);
  if (raw === undefined || raw === null) return fallback;
  if (!Array.isArray(raw)) {
    console.warn(
      `Invalid gallery.thumbnailGaps: "${raw}" (must be an array). ` +
      `Using defaults [${fallback.join(', ')}].`,
    );
    return fallback;
  }
  if (raw.length !== sizesLength) {
    console.warn(
      `Invalid gallery.thumbnailGaps: length ${raw.length} does not match ` +
      `thumbnailSizes length ${sizesLength}. ` +
      `Using defaults [${fallback.join(', ')}].`,
    );
    return fallback;
  }
  for (const value of raw) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      console.warn(
        `Invalid gallery.thumbnailGaps entry: "${value}" (must be a non-negative finite number). ` +
        `Using defaults [${fallback.join(', ')}].`,
      );
      return fallback;
    }
  }
  return raw;
}

export function resolveGallery(raw: GalleryConfig | undefined): ResolvedGallery {
  const thumbnailSizes = resolveThumbnailSizes(raw?.thumbnailSizes);
  const defaultThumbnailSizeIndex = resolveDefaultIndex(
    raw?.defaultThumbnailSizeIndex,
    thumbnailSizes.length,
  );
  const thumbnailGaps = resolveGaps(raw?.thumbnailGaps, thumbnailSizes.length);
  return { thumbnailSizes, defaultThumbnailSizeIndex, thumbnailGaps };
}

const resolved = resolveGallery(config.gallery);

/**
 * Resolved thumbnail sizes in device pixels, ordered smallest to largest.
 * Falls back to defaults if the `gallery.thumbnailSizes` block is missing
 * or invalid.
 */
export const GALLERY_THUMBNAIL_SIZES: readonly number[] = resolved.thumbnailSizes;

/**
 * Resolved default index into GALLERY_THUMBNAIL_SIZES, guaranteed to be
 * in range [0, GALLERY_THUMBNAIL_SIZES.length - 1].
 */
export const GALLERY_DEFAULT_SIZE_INDEX: number = resolved.defaultThumbnailSizeIndex;

/**
 * Resolved gap values in CSS px, one per thumbnail size step (smallest to
 * largest). Falls back to defaults if the `gallery.thumbnailGaps` block is
 * missing or invalid.
 */
export const GALLERY_THUMBNAIL_GAPS: readonly number[] = resolved.thumbnailGaps;

/**
 * Clamps a thumbnail-size index into the valid range
 * `[0, GALLERY_THUMBNAIL_SIZES.length - 1]`. Pure; non-finite or non-integer
 * inputs are not validated here — callers should pre-validate the type if
 * needed.
 */
export function clampThumbnailSizeIndex(n: number): number {
  return Math.max(0, Math.min(GALLERY_THUMBNAIL_SIZES.length - 1, n));
}
