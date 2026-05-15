import express, { Request, Response, Application } from 'express';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import { list, ListBlobResultBlob } from '@vercel/blob';
import { fileURLToPath } from 'url';

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

interface BlobCacheEntry {
  data: { blobs: ListBlobResultBlob[] };
  timestamp: number;
}

interface ListBlobsOptions {
  prefix?: string;
  limit?: number;
}

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
const PORT = process.env['PORT'] || 3000;

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
const HAS_BLOB_TOKEN = !!process.env['BLOB_READ_WRITE_TOKEN'];

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
  
  try {
    const result = await list(options);
    blobCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error: any) {
    if (error.name === 'BlobServiceRateLimited') {
      // If we hit rate limits, return cached data if available, even if expired
      if (cached) {
        console.log('Using expired cache due to rate limit');
        return cached.data;
      }
      // Wait for the suggested retry time (but cap it at 10 seconds for tests)
      const retryAfter = Math.min(error.retryAfter || 5, 10);
      console.log(`Rate limited, retrying in ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      try {
        const retryResult = await list(options);
        blobCache.set(cacheKey, { data: retryResult, timestamp: Date.now() });
        return retryResult;
      } catch (retryErr: any) {
        // Distinguish "still rate-limited on retry" from "retry hit a different
        // failure (e.g. connection error)". The former is a 429; the latter is
        // a 503 with no retry-after, since we don't have a meaningful hint.
        if (retryErr.name === 'BlobServiceRateLimited') {
          throw new BlobUnavailableError('Vercel Blob is rate-limited', {
            retryAfterSeconds: retryErr.retryAfter || retryAfter,
            rateLimited: true,
          });
        }
        throw new BlobUnavailableError(
          `Vercel Blob unavailable after retry: ${retryErr.message || retryErr.name || 'unknown error'}`
        );
      }
    }

    if (error.message && error.message.includes('No token found')) {
      console.log('Blob token missing, returning empty blob list for testing');
      return { blobs: [] };
    }

    throw new BlobUnavailableError(`Vercel Blob unavailable: ${error.message || error.name || 'unknown error'}`);
  }
}

function deriveCampaignId(c: any, index: number): string {
  // Prefer explicit id (most stable across rename of hashtag/icon_path),
  // fall back to hashtag, then icon_path. Random-fallback is forbidden because
  // it breaks hash-URL deep linking across server restarts.
  if (typeof c.id === 'string' && c.id.trim()) return slugify(c.id);
  if (typeof c.hashtag === 'string' && c.hashtag.trim()) return slugify(c.hashtag);
  if (typeof c.icon_path === 'string' && c.icon_path.trim()) return slugify(c.icon_path);
  throw new Error(
    `Campaign at index ${index} has no usable identifier (id, hashtag, or icon_path are all empty)`
  );
}

function loadCampaigns(): Campaign[] {
  const yamlPath = path.join(DATA_DIR, 'campaigns.yaml');
  const file = fs.readFileSync(yamlPath, 'utf8');
  const data = yaml.load(file) as { campaigns?: any[] } | null;
  const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
  return campaigns.map((c, i) => ({
    ...c,
    id: deriveCampaignId(c, i),
  }));
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
  } catch (err: any) {
    console.warn('Could not create dev build-info.json:', err.message);
  }
}

ensureDevBuildInfo();

// Log blob functionality status
if (HAS_BLOB_TOKEN) {
  console.log('🔵 Blob API: Enabled (token found)');
} else {
  console.log('⚪ Blob API: Disabled (no token - using fallback for testing)');
}

// Avatar redirect route for backward compatibility
// Redirects /avatars/* requests to the CDN URLs
app.get('/avatars/*', async (req: Request, res: Response): Promise<void> => {
  try {
    const avatarPath = req.params[0]; // Get everything after /avatars/
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
  } catch (err: any) {
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
    const campaigns = loadCampaigns();
    res.json({ campaigns });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

app.get('/api/campaigns/:id/images', async (req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = loadCampaigns();
    const campaign = campaigns.find((c) => c.id === req.params['id']);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Get the campaign's folder path for blob filtering
    const campaignPath = campaign.icon_path || '';
    const blobPrefix = campaignPath ? `avatars/${campaignPath}/` : 'avatars/';

    // List blobs with the campaign prefix
    const { blobs } = await listBlobsWithCache({
      prefix: blobPrefix,
      limit: 1000, // Adjust as needed for your image collection size
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
  } catch (err: any) {
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
  try {
    if (fs.existsSync(BUILD_INFO_PATH)) {
      const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf8');
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = {};
      }
      res.json({
        repoUrl: data.repoUrl || null,
        commitHash: data.commitHash || null,
        builtAt: data.builtAt || data.deployedAt || null // backward compatibility
      });
      return;
    }
    if (IS_DEV || !HAS_CLIENT_BUILD) {
      res.json({ 
        repoUrl: null, 
        commitHash: 'DEV-LOCAL', 
        builtAt: new Date().toISOString()
      });
      return;
    }
    res.json({ 
      repoUrl: null, 
      commitHash: null, 
      builtAt: null
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load build info' });
  }
});

// Content pages (History, Credits, Legal)
const VALID_CONTENT_PAGES = ['history', 'credits', 'legal'] as const;
type ContentPage = typeof VALID_CONTENT_PAGES[number];

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
    // Evict the oldest entry if we're at capacity (Map preserves insertion order)
    if (contentCache.size >= CONTENT_CACHE_MAX && !contentCache.has(page)) {
      const oldest = contentCache.keys().next().value;
      if (oldest !== undefined) contentCache.delete(oldest);
    }
    contentCache.set(page, { content, timestamp: Date.now() });
    res.json({ content, page });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
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
  } catch (err: any) {
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
app.all('/api/*', (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not found' });
});

// Serve SPA assets AFTER API routes so /api/* never falls through to HTML
if (HAS_CLIENT_BUILD) {
  app.use(express.static(CLIENT_DIST_DIR, { maxAge: '1d' }));
} else {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1d' }));
}

// SPA fallback
app.get('*', (_req: Request, res: Response): void => {
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