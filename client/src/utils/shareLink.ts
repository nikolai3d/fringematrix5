import type { ImageData } from '../types/api';

/** Query parameter carrying the shared image (lightbox Share button). */
export const SHARE_IMAGE_PARAM = 'img';

/**
 * Builds the URL the lightbox Share button hands out for `image`, preserving
 * the current path and hash (which selects the campaign). Prefers the image's
 * permanent registry id (short, and survives blob moves/renames); falls back
 * to its src for images without one.
 */
export function buildImageShareUrl(currentHref: string, image: Pick<ImageData, 'id' | 'src'>): string | null {
  const value = image.id || image.src;
  if (!value) return null;
  const url = new URL(currentHref);
  url.searchParams.set(SHARE_IMAGE_PARAM, value);
  return url.toString();
}

/** Reads the shared-image value from a location.search string, or null. */
export function readSharedImageParam(search: string): string | null {
  try {
    const value = new URLSearchParams(search).get(SHARE_IMAGE_PARAM);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Returns `search` with the shared-image parameter removed (other params
 * kept), including the leading '?' when anything remains.
 */
export function stripSharedImageParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(SHARE_IMAGE_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/**
 * Finds the image a share link points at. Matches the permanent id first,
 * then the exact src (links shared before ids existed carried the CDN URL),
 * then the blob path. Returns -1 when nothing matches.
 */
export function findSharedImageIndex(
  images: ReadonlyArray<Pick<ImageData, 'id' | 'src' | 'blobPath'>>,
  value: string | null,
): number {
  if (!value) return -1;
  const byId = images.findIndex((img) => !!img.id && img.id === value);
  if (byId !== -1) return byId;
  const bySrc = images.findIndex((img) => !!img.src && img.src === value);
  if (bySrc !== -1) return bySrc;
  return images.findIndex((img) => !!img.blobPath && img.blobPath === value);
}
