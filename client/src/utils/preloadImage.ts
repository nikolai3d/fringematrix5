/**
 * Warm the browser's HTTP/decoded-image cache for full-resolution lightbox
 * images so paging next/prev shows the neighbor instantly instead of a blank
 * frame while the original downloads.
 *
 * Remembers the last MAX_TRACKED URLs so re-rendering the same neighbors does
 * not create a new request object each time; the browser cache does the rest.
 */
const MAX_TRACKED = 64;
const requested = new Set<string>();

export function preloadImage(src: string | null | undefined): void {
  if (!src || typeof Image === 'undefined') return;
  if (requested.has(src)) return;
  if (requested.size >= MAX_TRACKED) {
    // Set iterates in insertion order, so this drops the oldest entry.
    const oldest = requested.values().next().value;
    if (oldest !== undefined) requested.delete(oldest);
  }
  requested.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}

/**
 * Preloads the images adjacent to `index` (wrapping, matching the lightbox's
 * circular navigation). `radius` neighbors are warmed on each side.
 */
export function preloadNeighbors(
  images: ReadonlyArray<{ src?: string | null }>,
  index: number,
  radius = 1,
): void {
  const n = images.length;
  if (n <= 1 || index < 0 || index >= n) return;
  for (let d = 1; d <= radius; d++) {
    preloadImage(images[(index + d) % n]?.src);
    preloadImage(images[(index - d + n) % n]?.src);
  }
}

/** Test-only: forget which URLs were requested. */
export function __resetPreloadCacheForTests(): void {
  requested.clear();
}
