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
