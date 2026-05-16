/**
 * Shared types used by both the server (server/server.ts) and the client
 * (client/src/types/api.ts). Adding a new content page requires updating
 * VALID_CONTENT_PAGES in server/server.ts to keep runtime validation in sync.
 */

// The valid content-page slugs served by GET /api/content/:page.
// Server-side runtime validation uses VALID_CONTENT_PAGES (a const tuple
// derived from this type) in server/server.ts.
export type ContentPage = 'history' | 'credits' | 'legal';
