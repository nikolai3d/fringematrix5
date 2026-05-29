/**
 * Responsive thumbnail image helpers.
 *
 * Images live on Vercel Blob and are served as direct CDN URLs
 * (`https://<store>.public.blob.vercel-storage.com/...`) at their original
 * dimensions/format. For the gallery GRID we don't need the full-resolution
 * source — a thumbnail-sized, modern-format (AVIF/WebP) variant is enough and
 * saves a large amount of bandwidth and decode time.
 *
 * On Vercel, the native Image Optimization API is exposed at
 * `/_vercel/image?url=<src>&w=<width>&q=<quality>` once the `images` block is
 * configured in `vercel.json` (see that file for the allowed widths, formats,
 * and the remotePatterns entry that whitelists the Blob host). The endpoint
 * negotiates AVIF/WebP automatically via the request `Accept` header, so we
 * only have to ask for the right WIDTH — the format is handled server-side.
 *
 * This module builds a `srcset` (with `w` descriptors) + `sizes` pair pointing
 * at that endpoint for thumbnails, while leaving the original `src` as the
 * fallback for environments where optimization is unavailable (local dev, or
 * any non-Blob URL such as the test/data fixtures).
 *
 * The LIGHTBOX intentionally does NOT use this — it still loads the original
 * full-resolution image directly.
 */

/**
 * Candidate widths (in physical/device pixels) offered to the browser for
 * thumbnails. These MUST be a subset of the `images.sizes` array in
 * `vercel.json` — the optimizer rejects (404s) any `w` not listed there.
 *
 * The range spans the gallery's smallest thumbnail (~120 device px) up to the
 * largest thumbnail on a 2x/3x display (480 device px logical → ~960 physical),
 * so the browser can pick an appropriate candidate for the current
 * `--thumbnail-min-size` and devicePixelRatio.
 */
export const THUMBNAIL_SRCSET_WIDTHS: readonly number[] = [160, 320, 480, 640, 960];

/** Quality requested from the optimizer. MUST be one of `images.qualities` in vercel.json. */
const THUMBNAIL_QUALITY = 75;

/**
 * Host suffix for Vercel Blob CDN URLs. We only rewrite URLs on this host:
 * the optimizer's `remotePatterns` only whitelists the Blob host, and other
 * URLs (relative test fixtures, `/avatars/...` redirects) must pass through
 * untouched.
 */
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

/**
 * True when the runtime can serve `/_vercel/image`. The endpoint only exists on
 * a Vercel deployment (production build); in `npm run dev` it 404s, so we leave
 * thumbnails on their original `src`. `import.meta.env.PROD` is statically
 * replaced by Vite at build time.
 */
function optimizationAvailable(): boolean {
  // import.meta.env is defined by Vite; guard for non-Vite environments (tests
  // that import this module run under Vitest, which DOES define it).
  return typeof import.meta !== 'undefined' && import.meta.env?.PROD === true;
}

/** True when `url` is an absolute Vercel Blob CDN URL we can hand to the optimizer. */
function isBlobUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === 'https:' && hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Build a single `/_vercel/image` URL for `src` at width `w`. */
function optimizedUrl(src: string, w: number): string {
  return `/_vercel/image?url=${encodeURIComponent(src)}&w=${w}&q=${THUMBNAIL_QUALITY}`;
}

export interface ResponsiveThumbnail {
  /** Fallback `src` — the original CDN URL (or whatever was passed in). */
  src: string;
  /** `srcset` of optimized variants, or undefined when optimization is unavailable. */
  srcSet?: string;
  /** `sizes` describing the rendered CSS width of a thumbnail, or undefined when no srcSet. */
  sizes?: string;
}

/**
 * Builds the responsive `<img>` attributes for a gallery thumbnail.
 *
 * @param src           Original image URL (Blob CDN URL in production).
 * @param renderedCssPx The thumbnail's rendered width in CSS pixels — i.e. the
 *                      current `--thumbnail-min-size` grid track minimum. Used
 *                      as the `sizes` value so the browser multiplies by the
 *                      devicePixelRatio when choosing a `w` candidate.
 *
 * Returns just `{ src }` (no srcset) when optimization is unavailable or `src`
 * is not an optimizable Blob URL, so callers can spread the result
 * unconditionally and get correct, working fallbacks.
 */
export function buildResponsiveThumbnail(src: string, renderedCssPx: number): ResponsiveThumbnail {
  if (!src || !optimizationAvailable() || !isBlobUrl(src)) {
    return { src };
  }

  const srcSet = THUMBNAIL_SRCSET_WIDTHS
    .map((w) => `${optimizedUrl(src, w)} ${w}w`)
    .join(', ');

  // `sizes` is the rendered CSS width of one thumbnail. The grid lays cards out
  // at `minmax(--thumbnail-min-size, 1fr)`, so each thumbnail is at least
  // `renderedCssPx` wide; we describe that minimum. A finite, positive width is
  // required — fall back to the smallest candidate otherwise.
  const cssPx = Number.isFinite(renderedCssPx) && renderedCssPx > 0
    ? Math.round(renderedCssPx)
    : THUMBNAIL_SRCSET_WIDTHS[0];

  return { src, srcSet, sizes: `${cssPx}px` };
}
