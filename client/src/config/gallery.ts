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

export interface ResolvedGallery {
  thumbnailSizes: readonly number[];
  defaultThumbnailSizeIndex: number;
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

export function resolveGallery(raw: GalleryConfig | undefined): ResolvedGallery {
  const thumbnailSizes = resolveThumbnailSizes(raw?.thumbnailSizes);
  const defaultThumbnailSizeIndex = resolveDefaultIndex(
    raw?.defaultThumbnailSizeIndex,
    thumbnailSizes.length,
  );
  return { thumbnailSizes, defaultThumbnailSizeIndex };
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
 * Clamps a thumbnail-size index into the valid range
 * `[0, GALLERY_THUMBNAIL_SIZES.length - 1]`. Pure; non-finite or non-integer
 * inputs are not validated here — callers should pre-validate the type if
 * needed.
 */
export function clampThumbnailSizeIndex(n: number): number {
  return Math.max(0, Math.min(GALLERY_THUMBNAIL_SIZES.length - 1, n));
}
