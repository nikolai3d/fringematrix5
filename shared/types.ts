/**
 * Shared types used by both the server (server/server.ts) and the client
 * (client/src/types/api.ts).
 *
 * ADDING A NEW CONTENT PAGE:
 *   1. Add the slug here (e.g. 'about').
 *   2. Add the same slug to VALID_CONTENT_PAGES in server/server.ts.
 *      TypeScript will catch values in VALID_CONTENT_PAGES that are NOT
 *      valid ContentPage slugs, but it will NOT catch slugs that are in
 *      ContentPage but missing from VALID_CONTENT_PAGES — those would cause
 *      the server to return 404 for the new page until step 2 is done.
 */

// The valid content-page slugs served by GET /api/content/:page.
export type ContentPage = 'history' | 'credits' | 'legal';
