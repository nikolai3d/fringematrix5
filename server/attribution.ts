import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Attribution data-access module
//
// Loads two on-disk data sources and caches them at module level for the rest
// of the process lifetime. A warm-up at module-eval time (see bottom of file)
// populates the caches eagerly, with the lazy ensure*Loaded() guards as a
// fallback if that warm-up is skipped or fails (e.g. after a test cache reset).
// Mirrors the same lazy-cache pattern used by campaignsCache / buildInfoCache
// in server.ts.
//
//   data/authors.yaml      — list of AuthorRecord (one per known artist)
//   data/attribution.json  — map of blob-path → AttributionRecord
//
// No HTTP routes are wired here; this module is consumed by future endpoints
// (see beads fringematrix5-7hh and fringematrix5-hzm). Local types are defined
// inline to keep this module decoupled from shared/types.ts during the
// parallel rollout of the attribution epic.
// ---------------------------------------------------------------------------

export type AttributionConfidence = 'high' | 'medium' | 'unresolved';

export interface AuthorRecord {
  handle: string;            // primary, including the @ prefix
  name: string;
  twitter_url: string | null;
  alternate_handles: string[];
  roles: string[];
  notes: string;
}

export interface AttributionRecord {
  handle: string | null;
  confidence: AttributionConfidence;
  candidates: string[];
  method: string;
  evidence: string;
}

// Resolve PROJECT_ROOT the same way server.ts does: one level up from the
// directory containing this file. Using fileURLToPath keeps the calculation
// correct under Node's native ESM loader (where __dirname is not defined).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const AUTHORS_YAML_PATH = path.join(DATA_DIR, 'authors.yaml');
const ATTRIBUTION_JSON_PATH = path.join(DATA_DIR, 'attribution.json');

// Module-level caches — populated once on first call and reused for the
// lifetime of the process. The underlying data files never change at runtime.
let authorsCache: AuthorRecord[] | null = null;
let authorIndexCache: Map<string, AuthorRecord> | null = null;
let attributionCache: Record<string, AttributionRecord> | null = null;

/**
 * Normalize a handle for case-insensitive lookup. Callers are expected to
 * pass handles with the leading '@' (as stored in authors.yaml), but the
 * function is tolerant: if '@' is missing it is prepended before comparison.
 */
function normalizeHandle(handle: string): string {
  const trimmed = handle.trim();
  const withAt = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  return withAt.toLowerCase();
}

function loadAuthors(): { authors: AuthorRecord[]; index: Map<string, AuthorRecord> } {
  const file = fs.readFileSync(AUTHORS_YAML_PATH, 'utf8');
  const data = yaml.load(file) as { authors?: AuthorRecord[] } | null;
  const authors: AuthorRecord[] = Array.isArray(data?.authors) ? data.authors : [];

  // Build a lowercase-keyed index covering both the primary handle and every
  // alternate_handles entry, so getAuthorByHandle() is O(1) per lookup.
  // Whitespace-only strings are skipped so accidental empty/whitespace YAML
  // entries cannot pollute the index with a bare '@' key.
  const index = new Map<string, AuthorRecord>();
  for (const author of authors) {
    if (typeof author.handle === 'string' && author.handle.trim().length > 0) {
      index.set(normalizeHandle(author.handle), author);
    }
    const alts = Array.isArray(author.alternate_handles) ? author.alternate_handles : [];
    for (const alt of alts) {
      if (typeof alt === 'string' && alt.trim().length > 0) {
        index.set(normalizeHandle(alt), author);
      }
    }
  }

  return { authors, index };
}

function ensureAuthorsLoaded(): { authors: AuthorRecord[]; index: Map<string, AuthorRecord> } {
  if (authorsCache === null || authorIndexCache === null) {
    const { authors, index } = loadAuthors();
    authorsCache = authors;
    authorIndexCache = index;
  }
  return { authors: authorsCache, index: authorIndexCache };
}

function loadAttribution(): Record<string, AttributionRecord> {
  const raw = fs.readFileSync(ATTRIBUTION_JSON_PATH, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, AttributionRecord>;
}

function ensureAttributionLoaded(): Record<string, AttributionRecord> {
  if (attributionCache === null) {
    attributionCache = loadAttribution();
  }
  return attributionCache;
}

/**
 * Returns all known author records, loading from data/authors.yaml on first
 * call and serving from the module-level cache thereafter.
 */
export function getAuthors(): AuthorRecord[] {
  return ensureAuthorsLoaded().authors;
}

/**
 * Returns the author record matching the given handle, or null if not found.
 *
 * Matching is case-insensitive and considers both the primary `handle` and
 * each entry in `alternate_handles`. Callers should pass handles prefixed
 * with '@' (matching the on-disk format); inputs missing the '@' are
 * tolerated and treated as if it were present.
 */
export function getAuthorByHandle(handle: string): AuthorRecord | null {
  if (typeof handle !== 'string' || handle.trim().length === 0) {
    return null;
  }
  const { index } = ensureAuthorsLoaded();
  return index.get(normalizeHandle(handle)) ?? null;
}

/**
 * Returns the full attribution table (blob-path → AttributionRecord), loading
 * from data/attribution.json on first call and serving from the module-level
 * cache thereafter. Used by aggregation endpoints (e.g. /api/authors) that
 * need to scan all entries; single-path callers should prefer
 * getAttributionForPath() which avoids exposing the full map.
 *
 * The returned object is the cached instance; the Readonly<> return type
 * blocks accidental writes at compile time. Callers must not bypass it via
 * casts — mutating the underlying map would corrupt subsequent reads for
 * the process lifetime.
 */
export function getAllAttributions(): Readonly<Record<string, AttributionRecord>> {
  return ensureAttributionLoaded();
}

/**
 * Returns the attribution record for an exact blob path (e.g.
 * "avatars/Season4/AcrossTheUniverse/ATU-Cheribot/AtU_amber.jpg"), or null
 * if the path is not present in data/attribution.json. Lookup is exact —
 * callers must pass the full blob key, not just a filename.
 */
export function getAttributionForPath(blobPath: string): AttributionRecord | null {
  if (typeof blobPath !== 'string' || blobPath.trim().length === 0) {
    return null;
  }
  const table = ensureAttributionLoaded();
  return Object.prototype.hasOwnProperty.call(table, blobPath)
    ? (table[blobPath] ?? null)
    : null;
}

/**
 * Resets the module-level attribution caches.
 * Exported for test isolation only — call before each test that mocks
 * fs.readFileSync to ensure the next call re-reads from the mock.
 */
export function resetAttributionCache(): void {
  authorsCache = null;
  authorIndexCache = null;
  attributionCache = null;
}

// Warm both caches at module-eval time. fs.readFileSync is synchronous, so this
// doesn't overlap anything — it simply shifts the ~816 KB attribution.json
// parse cost to module-eval (import) time so the first request that needs it
// isn't penalized. Wrapped in try/catch so a missing/unreadable data file
// degrades gracefully — the lazy ensure*Loaded() guards above remain the
// fallback (and the path used by tests after resetAttributionCache()).
try {
  ensureAuthorsLoaded();
  ensureAttributionLoaded();
} catch {
  // Ignore — the data will be (re)loaded lazily on first use.
}
