/**
 * Parses `window.location.hash` into one of three app routes:
 *   #authors           → authors index
 *   #authors/:handle   → single-author detail page
 *   #<anything-else>   → gallery view (the value is treated as a campaign id)
 *
 * The handle segment is URL-decoded so the leading "@" round-trips through
 * encodeURIComponent (which the AuthorDetail page uses when fetching).
 *
 * Empty hashes also fall through as gallery routes with a null campaignId, so
 * App.tsx can apply its existing "first campaign" default.
 */
export type HashRoute =
  | { type: 'gallery'; campaignId: string | null }
  | { type: 'authors-index' }
  | { type: 'author-detail'; handle: string };

export function parseHashRoute(rawHash: string): HashRoute {
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  if (!hash) {
    return { type: 'gallery', campaignId: null };
  }
  if (hash === 'authors') {
    return { type: 'authors-index' };
  }
  if (hash.startsWith('authors/')) {
    const rest = hash.slice('authors/'.length);
    if (rest.length === 0) {
      return { type: 'authors-index' };
    }
    let handle: string;
    try {
      handle = decodeURIComponent(rest);
    } catch {
      // malformed escape — treat as raw text rather than crashing
      handle = rest;
    }
    return { type: 'author-detail', handle };
  }
  return { type: 'gallery', campaignId: hash };
}
