import express, { Request, Response, Application } from 'express';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import { list, ListBlobResultBlob } from '@vercel/blob';
import { fileURLToPath } from 'url';
import { VALID_CONTENT_PAGES } from '../shared/types.js';
import type { ContentPage } from '../shared/types.js';
import { timeoutMiddleware } from './middleware/timeout.js';

interface Campaign {
  id: string;
  hashtag?: string;
  icon_path?: string;
  [key: string]: any;
}

interface ImageData {
  src: string;
  fileName: string;
  blobPath: string;
  size: number;
}

interface BuildInfo {
  repoUrl: string | null;
  commitHash: string | null;
  builtAt: string | null;
}

type BlobListResult = { blobs: ListBlobResultBlob[] };

interface BlobCacheEntry {
  data: BlobListResult;
  timestamp: number;
}

interface ListBlobsOptions {
  prefix?: string;
  /** When set, fetch only a single page capped at this limit (no pagination loop). */
  limit?: number;
}

/** Raw shape of a campaign entry as parsed from campaigns.yaml. */
interface RawCampaign {
  id?: string;
  hashtag?: string;
  icon_path?: string;
  name?: string;
  [key: string]: unknown;
}

// Maximum total blobs collected across all pages in a single paginated fetch.
// Guards against runaway memory usage if a prefix contains an unexpectedly
// large number of items. At ~1 KB per blob metadata entry, 10 000 entries
// is about 10 MB — well within acceptable server memory for a response.
const MAX_BLOB_ITEMS = 10_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_DEV = process.env['NODE_ENV'] !== 'production';

// Auto-load .env.local if present. `override: false` preserves any value
// already in process.env (matching the old handrolled-parser semantics)
// and gives precedence to whoever launched the process.
const ENV_LOCAL_PATH = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(ENV_LOCAL_PATH)) {
  dotenv.config({ path: ENV_LOCAL_PATH, override: false });

  if (IS_DEV) {
    console.log('📋 Loaded environment variables from .env.local');
    console.log('🔑 BLOB_READ_WRITE_TOKEN:', process.env['BLOB_READ_WRITE_TOKEN'] ? 'FOUND' : 'MISSING');
  }
}

const app: Application = express();
// Remove the default X-Powered-By: Express header to avoid fingerprinting the server stack.
app.disable('x-powered-by');
const PORT = process.env['PORT'] || 3000;

app.use(timeoutMiddleware);

// Project root is one level up from this file (which lives in server/)
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'content');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const CLIENT_DIST_DIR = path.join(PROJECT_ROOT, 'client', 'dist');
const HAS_CLIENT_BUILD = fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'));
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'build-info.json');

// Simple cache for blob listings to reduce API calls during testing
const blobCache = new Map<string, BlobCacheEntry>();
const CACHE_TTL = 30000; // 30 seconds cache during development/testing
const BLOB_CACHE_MAX = 100; // Maximum number of unique cache entries (LRU eviction)
const HAS_BLOB_TOKEN = !!process.env['BLOB_READ_WRITE_TOKEN'];

/**
 * Stores a blob list result in the cache under the given key, applying LRU
 * eviction when the cache is at capacity.
 *
 * Delete-before-set moves an already-cached key to the tail of the Map's
 * insertion-order iteration, so re-fetched entries are the last to be
 * evicted rather than the next.
 */
function cacheBlobResult(key: string, result: BlobListResult): void {
  blobCache.delete(key);
  if (blobCache.size >= BLOB_CACHE_MAX) {
    const oldest = blobCache.keys().next().value;
    if (oldest !== undefined) blobCache.delete(oldest);
  }
  blobCache.set(key, { data: result, timestamp: Date.now() });
}

// Module-level campaigns cache — populated once on first request and reused
// for the lifetime of the process. campaigns.yaml never changes at runtime.
let campaignsCache: Campaign[] | null = null;

// Module-level build-info cache — populated once on first request and reused
// for the lifetime of the process. build-info.json is generated at build time
// and never changes while the server is running.
let buildInfoCache: BuildInfo | null = null;

// Shape of the rate-limit error thrown by the @vercel/blob SDK.
interface BlobRateLimitedError extends Error {
  name: 'BlobServiceRateLimited';
  retryAfter?: number;
}

function isBlobRateLimitedError(err: unknown): err is BlobRateLimitedError {
  return err instanceof Error && err.name === 'BlobServiceRateLimited';
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Thrown when the upstream Vercel Blob API is unreachable or rate-limited and
// no usable cache fallback exists. Route handlers translate this into a 503
// (or 429) so the client can render an actionable error instead of a generic
// "no images" empty state.
class BlobUnavailableError extends Error {
  retryAfterSeconds?: number;
  rateLimited: boolean;
  constructor(message: string, opts: { retryAfterSeconds?: number; rateLimited?: boolean } = {}) {
    super(message);
    this.name = 'BlobUnavailableError';
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.rateLimited = opts.rateLimited ?? false;
  }
}

function sendBlobError(res: Response, err: BlobUnavailableError, fallbackMessage: string): void {
  const status = err.rateLimited ? 429 : 503;
  if (err.retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(err.retryAfterSeconds));
  }
  res.status(status).json({ error: err.message || fallbackMessage });
}

// Cache for content pages (History, Credits, Legal).
// TTL protects against stale reads if content/*.html is edited under a running
// server; size cap is a safety net against unbounded growth if the set of
// valid content pages expands later.
interface ContentCacheEntry {
  content: string;
  timestamp: number;
}
const contentCache = new Map<string, ContentCacheEntry>();
const CONTENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CONTENT_CACHE_MAX = 16;

/**
 * Fetches blobs from Vercel Blob, with in-memory caching and optional cursor
 * pagination.
 *
 * When `options.limit` is omitted (the default), the function pages through
 * ALL results using the cursor returned by each `list()` call, accumulating
 * blobs until `hasMore` is false or `MAX_BLOB_ITEMS` is reached. This
 * replaces the old single-call `limit: 1000` approach and ensures campaigns
 * with thousands of images are fully returned without silently truncating.
 *
 * When `options.limit` is provided, a single `list()` call is made (no
 * pagination loop). This is used by the `/avatars/*` redirect route which
 * only needs the first matching blob.
 */
async function listBlobsWithCache(options: ListBlobsOptions): Promise<{ blobs: ListBlobResultBlob[] }> {
  // If no blob token is available (e.g., in CI), return empty results
  if (!HAS_BLOB_TOKEN) {
    console.log('No BLOB_READ_WRITE_TOKEN found, returning empty blob list for testing');
    return { blobs: [] };
  }

  const cacheKey = JSON.stringify(options);
  const cached = blobCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Helper: fetch all pages for a prefix, accumulating up to MAX_BLOB_ITEMS.
  // Only used when no explicit limit is supplied.
  async function fetchAllPages(): Promise<{ blobs: ListBlobResultBlob[] }> {
    const accumulated: ListBlobResultBlob[] = [];
    let cursor: string | undefined = undefined;

    do {
      const page = await list({
        prefix: options.prefix,
        limit: 1000, // per-page size; Vercel Blob's documented max per call
        ...(cursor ? { cursor } : {}),
      });

      accumulated.push(...page.blobs);

      if (!page.hasMore || accumulated.length >= MAX_BLOB_ITEMS) {
        if (accumulated.length >= MAX_BLOB_ITEMS) {
          console.warn(
            `listBlobsWithCache: reached MAX_BLOB_ITEMS (${MAX_BLOB_ITEMS}) for prefix "${options.prefix ?? ''}". ` +
            'Some blobs may have been omitted. Consider splitting this campaign into sub-folders.'
          );
        }
        break;
      }

      cursor = page.cursor;
    } while (cursor);

    return { blobs: accumulated };
  }

  try {
    // Single-page fetch when an explicit limit was requested (e.g. exact-match
    // lookups in the /avatars/* redirect route).
    const result = options.limit !== undefined
      ? await list(options)
      : await fetchAllPages();

    cacheBlobResult(cacheKey, result);
    return result;
  } catch (error: unknown) {
    if (isBlobRateLimitedError(error)) {
      // If we hit rate limits, return cached data if available, even if expired
      if (cached) {
        console.log('Using expired cache due to rate limit');
        return cached.data;
      }
      // Wait for the suggested retry time (but cap it at 10 seconds for tests)
      const retryAfter = Math.min(error.retryAfter ?? 5, 10);
      console.log(`Rate limited, retrying in ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      try {
        const retryResult = options.limit !== undefined
          ? await list(options)
          : await fetchAllPages();
        cacheBlobResult(cacheKey, retryResult);
        return retryResult;
      } catch (retryErr: unknown) {
        // Distinguish "still rate-limited on retry" from "retry hit a different
        // failure (e.g. connection error)". The former is a 429; the latter is
        // a 503 with no retry-after, since we don't have a meaningful hint.
        if (isBlobRateLimitedError(retryErr)) {
          throw new BlobUnavailableError('Vercel Blob is rate-limited', {
            retryAfterSeconds: retryErr.retryAfter ?? retryAfter,
            rateLimited: true,
          });
        }
        throw new BlobUnavailableError(
          `Vercel Blob unavailable after retry: ${toErrorMessage(retryErr)}`
        );
      }
    }

    throw new BlobUnavailableError(`Vercel Blob unavailable: ${toErrorMessage(error)}`);
  }
}

function deriveCampaignId(c: RawCampaign, index: number): string {
  // Prefer explicit id (most stable across rename of hashtag/icon_path),
  // fall back to hashtag, then icon_path. Random-fallback is forbidden because
  // it breaks hash-URL deep linking across server restarts.
  // slugify can produce an empty string from inputs with no alphanumerics
  // (e.g. "@@@!!!"); in that case fall through to the next candidate.
  for (const candidate of [c.id, c.hashtag, c.icon_path]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const slug = slugify(candidate);
    if (slug) return slug;
  }
  throw new Error(
    `Campaign at index ${index} has no usable identifier (id, hashtag, and icon_path all empty or non-alphanumeric)`
  );
}

function loadCampaigns(): Campaign[] {
  const yamlPath = path.join(DATA_DIR, 'campaigns.yaml');
  const file = fs.readFileSync(yamlPath, 'utf8');
  const data = yaml.load(file) as { campaigns?: RawCampaign[] } | null;
  const campaigns: RawCampaign[] = Array.isArray(data?.campaigns) ? data.campaigns : [];
  const mapped = campaigns.map((c, i) => ({
    ...c,
    id: deriveCampaignId(c, i),
  }));

  // Detect duplicate ids — two campaigns producing the same slug would make the
  // second one permanently unreachable via find-by-id.
  const seen = new Map<string, any>();
  for (const campaign of mapped) {
    const { id } = campaign;
    if (seen.has(id)) {
      const prev = seen.get(id);
      throw new Error(
        `Duplicate campaign id '${id}': conflicts between` +
        ` {hashtag: ${JSON.stringify(prev.hashtag ?? null)}, icon_path: ${JSON.stringify(prev.icon_path ?? null)}}` +
        ` and {hashtag: ${JSON.stringify(campaign.hashtag ?? null)}, icon_path: ${JSON.stringify(campaign.icon_path ?? null)}}`
      );
    }
    seen.set(id, campaign);
  }

  return mapped;
}

/**
 * Returns the campaigns list, loading and caching it on the first call.
 * The data comes from campaigns.yaml which never changes during process
 * lifetime, so parsing once at module level is safe and avoids repeated
 * blocking FS reads + YAML parses on every hot-path request.
 */
function getCampaigns(): Campaign[] {
  if (campaignsCache === null) {
    campaignsCache = loadCampaigns();
  }
  return campaignsCache;
}

function slugify(str: string): string {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// walkDirectoryRecursive function removed - no longer needed with blob storage

function isImageFile(pathname: string): boolean {
  const ext = path.extname(pathname).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'].includes(ext);
}

// Ensure a dev build-info.json exists locally for debugging locally
function ensureDevBuildInfo(): void {
  try {
    const shouldCreateDevInfo = (!fs.existsSync(BUILD_INFO_PATH)) && (IS_DEV || !HAS_CLIENT_BUILD);
    if (shouldCreateDevInfo) {
      const devInfo: BuildInfo = {
        repoUrl: null,
        commitHash: 'DEV-LOCAL',
        builtAt: new Date().toISOString()
      };
      fs.writeFileSync(BUILD_INFO_PATH, JSON.stringify(devInfo, null, 2), 'utf8');
    }
  } catch (err: unknown) {
    console.warn('Could not create dev build-info.json:', toErrorMessage(err));
  }
}

ensureDevBuildInfo();

/**
 * Reads and parses build-info.json, returning a normalized BuildInfo object.
 * When the file is present it is parsed and returned directly.
 * When the file is absent: returns a DEV-LOCAL object in dev mode or when there
 * is no client build, and returns all-nulls only in production with a client build.
 */
function loadBuildInfo(): BuildInfo {
  if (fs.existsSync(BUILD_INFO_PATH)) {
    const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf8');
    let data: Partial<BuildInfo> & { deployedAt?: string | null };
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = {};
    }
    return {
      repoUrl: data.repoUrl || null,
      commitHash: data.commitHash || null,
      builtAt: data.builtAt || data.deployedAt || null // deployedAt was the field name before builtAt was introduced; kept for builds pre-dating the rename
    };
  }
  if (IS_DEV || !HAS_CLIENT_BUILD) {
    return {
      repoUrl: null,
      commitHash: 'DEV-LOCAL',
      builtAt: new Date().toISOString()
    };
  }
  return { repoUrl: null, commitHash: null, builtAt: null };
}

/**
 * Returns the build-info, loading and caching it on the first call.
 * build-info.json is immutable for the process lifetime (generated at build time).
 */
function getBuildInfo(): BuildInfo {
  if (buildInfoCache === null) {
    buildInfoCache = loadBuildInfo();
  }
  return buildInfoCache;
}

// Log blob functionality status
if (HAS_BLOB_TOKEN) {
  console.log('🔵 Blob API: Enabled (token found)');
} else {
  console.log('⚪ Blob API: Disabled (no token - using fallback for testing)');
}

// Avatar redirect route for backward compatibility
// Redirects /avatars/* requests to the CDN URLs
app.get('/avatars/*path', async (req: Request, res: Response): Promise<void> => {
  try {
    // In Express 5 (path-to-regexp 8.x), wildcard params are arrays of segments
    const pathParam = req.params['path'];
    const avatarPath = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;
    const blobPath = `avatars/${avatarPath}`;
    
    // Find the blob with this exact path
    const { blobs } = await listBlobsWithCache({ 
      prefix: blobPath,
      limit: 1 
    });
    
    // Look for exact match
    const blob = blobs.find(b => b.pathname === blobPath);
    
    if (!blob) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }
    
    // Redirect to the CDN URL
    res.redirect(302, blob.url);
  } catch (err: unknown) {
    if (err instanceof BlobUnavailableError) {
      console.error('Avatar redirect blob error:', err.message);
      sendBlobError(res, err, 'Failed to serve avatar');
      return;
    }
    console.error('Avatar redirect error:', err);
    res.status(500).json({ error: 'Failed to serve avatar' });
  }
});

// API endpoints
app.get('/api/campaigns', (_req: Request, res: Response): void => {
  try {
    const campaigns = getCampaigns();
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.set('Vary', 'Accept-Encoding');
    res.json({ campaigns });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

app.get('/api/campaigns/:id/images', async (req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = getCampaigns();
    const campaign = campaigns.find((c) => c.id === req.params['id']);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Get the campaign's folder path for blob filtering
    const campaignPath = campaign.icon_path || '';
    const blobPrefix = campaignPath ? `avatars/${campaignPath}/` : 'avatars/';

    // List blobs with the campaign prefix (no limit = paginate through all pages)
    const { blobs } = await listBlobsWithCache({
      prefix: blobPrefix,
    });

    // Filter for image files and format response
    const images: ImageData[] = blobs
      .filter(blob => isImageFile(blob.pathname))
      .map(blob => ({
        src: blob.url, // Direct CDN URL
        fileName: blob.pathname.split('/').pop() || '', // Extract filename from path
        // Optional: keep backward compatibility info
        blobPath: blob.pathname,
        size: blob.size,
      }));

    res.json({ images });
  } catch (err: unknown) {
    if (err instanceof BlobUnavailableError) {
      console.error('Campaign images blob error:', err.message);
      sendBlobError(res, err, 'Failed to list images from CDN');
      return;
    }
    console.error('Blob listing error:', err);
    res.status(500).json({ error: 'Failed to list images from CDN' });
  }
});

// Build info endpoint
app.get('/api/build-info', (_req: Request, res: Response): void => {
  const CACHE_HEADERS = 'public, max-age=3600, stale-while-revalidate=86400';
  try {
    const info = getBuildInfo();
    res.set('Cache-Control', CACHE_HEADERS);
    res.set('Vary', 'Accept-Encoding');
    res.json(info);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load build info' });
  }
});

// Content pages (History, Credits, Legal)
// VALID_CONTENT_PAGES is imported from shared/types.ts, and ContentPage is
// derived from it there — so adding a slug to VALID_CONTENT_PAGES in
// shared/types.ts is the single change needed when adding a new page.

app.get('/api/content/:page', async (req: Request, res: Response): Promise<void> => {
  const page = req.params['page'] as string;

  if (!VALID_CONTENT_PAGES.includes(page as ContentPage)) {
    res.status(404).json({ error: 'Content page not found' });
    return;
  }

  // Check cache first
  const cached = contentCache.get(page);
  if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL) {
    res.json({ content: cached.content, page });
    return;
  }

  const contentPath = path.join(CONTENT_DIR, `${page}.html`);

  try {
    const content = await fs.promises.readFile(contentPath, 'utf8');
    // Evict the oldest entry if we're at capacity (Map preserves insertion order).
    // Delete-before-set on the refresh path so a re-cached entry moves to the
    // end of the iteration order — otherwise Map.set on an existing key keeps
    // its original position and the just-refreshed entry would be the next
    // eviction target.
    contentCache.delete(page);
    if (contentCache.size >= CONTENT_CACHE_MAX) {
      const oldest = contentCache.keys().next().value;
      if (oldest !== undefined) contentCache.delete(oldest);
    }
    contentCache.set(page, { content, timestamp: Date.now() });
    res.json({ content, page });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json({ error: 'Content file not found' });
    } else {
      console.error('Content read error:', err);
      res.status(500).json({ error: 'Failed to load content' });
    }
  }
});

// Glyphs endpoint for loading spinner
app.get('/api/glyphs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const blobPrefix = 'avatars/_images/Glyphs/small/';
    
    const { blobs } = await listBlobsWithCache({
      prefix: blobPrefix,
      limit: 100,
    });

    // Filter for image files and return URLs
    const glyphs = blobs
      .filter(blob => isImageFile(blob.pathname))
      .map(blob => blob.url);

    res.json({ glyphs });
  } catch (err: unknown) {
    if (err instanceof BlobUnavailableError) {
      console.error('Glyphs blob error:', err.message);
      sendBlobError(res, err, 'Failed to list glyphs');
      return;
    }
    console.error('Glyphs listing error:', err);
    res.status(500).json({ error: 'Failed to list glyphs' });
  }
});

// Ensure unknown /api/* paths return JSON (not SPA HTML)
app.all('/api/*path', (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not found' });
});

// Serve SPA assets AFTER API routes so /api/* never falls through to HTML
if (HAS_CLIENT_BUILD) {
  app.use(express.static(CLIENT_DIST_DIR, { maxAge: '1d' }));
} else {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1d' }));
}

// SPA fallback
app.get('*path', (_req: Request, res: Response): void => {
  if (HAS_CLIENT_BUILD) {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  } else {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
});

// Only start the server if this file is executed directly (not when imported for tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`Fringe Matrix backend running on http://localhost:${PORT}`);
  });
}

// Export the app for testing
export default app;

// Exported for tests only – do not use in application code
export { blobCache, CACHE_TTL, BLOB_CACHE_MAX, MAX_BLOB_ITEMS };

/**
 * Resets the module-level campaigns cache.
 * Exported for test isolation only — call before each test that mocks
 * fs.readFileSync to ensure getCampaigns() re-reads from the mock.
 */
export function resetCampaignsCache(): void {
  campaignsCache = null;
}

/**
 * Resets the module-level build-info cache.
 * Exported for test isolation only — call before each test that writes or mocks
 * build-info.json to ensure getBuildInfo() re-reads from the updated file.
 */
export function resetBuildInfoCache(): void {
  buildInfoCache = null;
}