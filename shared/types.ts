/**
 * Shared types used by both the server (server/server.ts) and the client
 * (client/src/types/api.ts).
 *
 * ADDING A NEW CONTENT PAGE:
 *   1. Add the slug to VALID_CONTENT_PAGES below (e.g. 'about').
 *   2. ContentPage is derived from VALID_CONTENT_PAGES, so the type stays in
 *      sync automatically — no separate update needed.
 *   3. The server imports VALID_CONTENT_PAGES directly and uses it for
 *      validation, so the new page will be served without any other changes.
 */

// The valid content-page slugs served by GET /api/content/:page.
// ContentPage is derived from this array, ensuring the type and the runtime
// validation list are always in sync (exhaustiveness guaranteed by derivation).
export const VALID_CONTENT_PAGES = ['history', 'credits', 'legal'] as const;
export type ContentPage = (typeof VALID_CONTENT_PAGES)[number];

// Image attribution / authorship types.
// On-disk data (produced by bead fringematrix5-kj7, not yet in-repo) will live
// in data/attribution.json (per-blob-path entries with raw evidence) and
// data/authors.yaml (one entry per known handle). The wire shapes below are a
// deliberately trimmed view of that data — the server joins the two sources
// and exposes only the fields the client needs.

export type AttributionConfidence = 'high' | 'medium' | 'unresolved';

// Wire-format shape attached to each image returned by
// GET /api/campaigns/:id/images once the enrichment (bead fringematrix5-hzm)
// lands. Intentionally narrower than the on-disk attribution record: raw
// fields like `method` and `evidence` stay server-side.
export interface ImageAuthor {
  handle: string | null;       // resolved handle, e.g. "@Zort70", or null when unresolved
  displayName: string | null;  // resolved display name, or null when unresolved
  twitterUrl: string | null;
  confidence: AttributionConfidence;
  candidates: string[];        // populated when confidence !== 'high'; list of "@handle" strings
}

// Author entry surfaced by /api/authors and /api/authors/:handle.
export interface Author {
  handle: string;
  name: string;
  twitterUrl: string | null;
  alternateHandles: string[];
  roles: string[];
}

export interface AuthorWithCount extends Author {
  imageCount: number;
}

// Sentinel handle for the virtual "Unknown artist" entry.
//
// This is NOT a real Twitter handle — it cannot collide with one because real
// handles cannot contain '__'. The all-artists page surfaces a pinned card
// using this handle; clicking it navigates to `#authors/__unknown__`, which
// the server's /api/authors/:handle endpoint recognizes and answers with a
// synthetic author + the list of every image whose attribution has no
// resolved handle (i.e. AttributionRecord.handle === null).
//
// Dependent beads fringematrix5-0y9l (image → Unknown artist link from the
// lightbox) and fringematrix5-zh88 (empty-artist disclaimer link) target the
// same URL/route shape: `#authors/__unknown__` → AuthorDetail page in
// "unknown" mode.
export const UNKNOWN_ARTIST_HANDLE = '__unknown__';

// The user-visible display name for the virtual "Unknown artist" entry.
// Kept in shared/ so both server (synthetic author payload) and client
// (AuthorsIndex pinned card + AuthorDetail header) use the exact same string.
export const UNKNOWN_ARTIST_NAME = 'Unknown artist';
