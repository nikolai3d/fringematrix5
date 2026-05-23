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
// On-disk data lives in data/attribution.json (per-blob-path) and
// data/authors.yaml (one entry per known handle). The wire shapes below are
// what the API serves; the server is responsible for joining the two sources.

export type AttributionConfidence = 'high' | 'medium' | 'unresolved';

// Wire-format shape attached to each image returned by
// GET /api/campaigns/:id/images once the enrichment lands.
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
