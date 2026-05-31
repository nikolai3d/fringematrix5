import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Image registry data-access module
//
// Loads data/images.json and caches it at module level for the process
// lifetime, mirroring the lazy-cache + eager-warm-up pattern used by
// attribution.ts and campaignsCache in server.ts.
//
//   data/images.json — map of imageId -> ImageRecord
//
// Each image has a permanent UUID (assigned by scripts/images-init.mjs) that
// is decoupled from its Blob location, so moving/renaming/reattributing a file
// never breaks its attribution record (which is keyed by this same id).
//
// A reverse blobPath -> id index is built alongside so the campaign-images hot
// path can resolve an id from a blob path with O(1) lookups and no per-request
// I/O.
// ---------------------------------------------------------------------------

export type ImageStatus = 'active' | 'deleted';

export interface ImageRecord {
  blobPath: string;
  contentHash: string | null;
  size: number | null;
  campaignId: string | null;
  status: ImageStatus;
  addedAt: string;
  updatedAt: string;
}

// Resolve PROJECT_ROOT the same way server.ts / attribution.ts do.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const IMAGES_JSON_PATH = path.join(DATA_DIR, 'images.json');

let imagesCache: Record<string, ImageRecord> | null = null;
let blobPathIndexCache: Map<string, string> | null = null;

function loadImages(): {
  images: Record<string, ImageRecord>;
  index: Map<string, string>;
} {
  const images: Record<string, ImageRecord> = (() => {
    if (!fs.existsSync(IMAGES_JSON_PATH)) return {};
    const raw = fs.readFileSync(IMAGES_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, ImageRecord>;
  })();

  // Build the reverse blobPath -> id index. A duplicate blobPath means two ids
  // claim the same file — keep the first and ignore the rest so a hand-edited
  // registry can't crash the read path (the validate script flags duplicates).
  const index = new Map<string, string>();
  for (const [id, rec] of Object.entries(images)) {
    if (rec && typeof rec.blobPath === 'string' && !index.has(rec.blobPath)) {
      index.set(rec.blobPath, id);
    }
  }

  return { images, index };
}

function ensureImagesLoaded(): {
  images: Record<string, ImageRecord>;
  index: Map<string, string>;
} {
  if (imagesCache === null || blobPathIndexCache === null) {
    const { images, index } = loadImages();
    imagesCache = images;
    blobPathIndexCache = index;
  }
  return { images: imagesCache, index: blobPathIndexCache };
}

/**
 * Returns the image record for an id, or null if not present.
 */
export function getImageById(id: string): ImageRecord | null {
  if (typeof id !== 'string' || id.trim().length === 0) return null;
  const { images } = ensureImagesLoaded();
  return Object.prototype.hasOwnProperty.call(images, id) ? (images[id] ?? null) : null;
}

/**
 * Returns the registry entry { id, record } for an exact blob path, or null
 * if the path is not registered.
 */
export function getImageByBlobPath(
  blobPath: string
): { id: string; record: ImageRecord } | null {
  if (typeof blobPath !== 'string' || blobPath.trim().length === 0) return null;
  const { images, index } = ensureImagesLoaded();
  const id = index.get(blobPath);
  if (id === undefined) return null;
  const record = images[id];
  return record ? { id, record } : null;
}

/**
 * Returns the full registry (imageId -> ImageRecord). The Readonly<> return
 * type blocks accidental writes; callers must not mutate the cached instance.
 */
export function getAllImages(): Readonly<Record<string, ImageRecord>> {
  return ensureImagesLoaded().images;
}

/**
 * Resets the module-level caches. Exported for test isolation only.
 */
export function resetImagesCache(): void {
  imagesCache = null;
  blobPathIndexCache = null;
}

// Warm the cache at module-eval time. Wrapped in try/catch so a missing or
// unreadable images.json degrades gracefully — the lazy ensure guard above
// remains the fallback (and the path used by tests after resetImagesCache()).
try {
  ensureImagesLoaded();
} catch {
  // Ignore — data is (re)loaded lazily on first use.
}
