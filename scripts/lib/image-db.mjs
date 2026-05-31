/**
 * image-db.mjs — shared helpers for the image-database maintenance tooling.
 *
 * The "image database" is three git-tracked files plus Vercel Blob:
 *   - data/images.json      — the image registry (this module's main concern):
 *                             { [imageId]: { blobPath, contentHash, size,
 *                               campaignId, status, addedAt, updatedAt } }
 *   - data/attribution.json — per-image attribution, keyed by imageId
 *   - data/campaigns.yaml    — campaigns (used to derive campaignId from a path)
 *
 * Every image gets a permanent UUID (decoupled from its Blob location) so that
 * moving/renaming/reattributing a file never breaks its attribution record.
 *
 * This module holds the pure, unit-testable pieces (id/hash generation, path
 * derivation, deterministic load/save) plus thin wrappers around the Vercel
 * Blob network calls (listAllBlobs) so the CLI scripts share one implementation.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from this file (scripts/lib/image-db.mjs).
export const PROJECT_ROOT = path.join(__dirname, '..', '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const IMAGES_JSON_PATH = path.join(DATA_DIR, 'images.json');
export const ATTRIBUTION_JSON_PATH = path.join(DATA_DIR, 'attribution.json');
export const CAMPAIGNS_YAML_PATH = path.join(DATA_DIR, 'campaigns.yaml');

export const SUPPORTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg',
];

// ---------------------------------------------------------------------------
// .env.local loader — mirrors assets/migrate-to-blob.mjs so the Blob token is
// picked up the same way across all tooling.
// ---------------------------------------------------------------------------
export function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
    if (!process.env[key.trim()]) process.env[key.trim()] = value;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Generate a new permanent image id (random UUIDv4). */
export function generateId() {
  return crypto.randomUUID();
}

/** Compute the content hash of image bytes as "sha256:<hex>". */
export function hashBytes(buffer) {
  const hex = crypto.createHash('sha256').update(buffer).digest('hex');
  return `sha256:${hex}`;
}

/** True if the pathname has a supported image extension. */
export function isImageFile(pathname) {
  return SUPPORTED_EXTENSIONS.includes(path.extname(pathname).toLowerCase());
}

/** Slugify — identical algorithm to server.ts slugify() so ids stay in sync. */
export function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * Derive a campaign id from a raw campaign entry — mirrors
 * deriveCampaignId() in server.ts (prefers id, then hashtag, then icon_path).
 * Returns null if none yields a usable slug.
 */
export function campaignSlug(rawCampaign) {
  for (const candidate of [rawCampaign.id, rawCampaign.hashtag, rawCampaign.icon_path]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const slug = slugify(candidate);
    if (slug) return slug;
  }
  return null;
}

/** Load and parse data/campaigns.yaml into the raw campaign array. */
export function loadCampaigns() {
  const file = fs.readFileSync(CAMPAIGNS_YAML_PATH, 'utf8');
  const data = yaml.load(file);
  return Array.isArray(data?.campaigns) ? data.campaigns : [];
}

/**
 * Derive the campaignId for a blob path by matching the campaign whose
 * icon_path is the longest prefix of the path (after stripping "avatars/").
 * Returns null if no campaign matches.
 *
 * @param blobPath e.g. "avatars/Season4/CrossTheLine/artist/file.jpg"
 * @param campaigns raw campaign array from loadCampaigns()
 */
export function deriveCampaignId(blobPath, campaigns) {
  const rel = blobPath.replace(/^avatars\//, '');
  let best = null;
  let bestLen = -1;
  for (const c of campaigns) {
    const iconPath = typeof c.icon_path === 'string' ? c.icon_path : '';
    if (!iconPath) continue;
    const prefix = iconPath.endsWith('/') ? iconPath : `${iconPath}/`;
    if (rel === iconPath || rel.startsWith(prefix)) {
      if (iconPath.length > bestLen) {
        best = c;
        bestLen = iconPath.length;
      }
    }
  }
  return best ? campaignSlug(best) : null;
}

/**
 * Build a blob path from a campaign's icon_path, an optional artist folder,
 * and a filename. Segments are joined with "/" and the "avatars/" prefix is
 * guaranteed. Empty segments are dropped.
 */
export function buildBlobPath({ iconPath, artistFolder, fileName }) {
  const segments = ['avatars', iconPath, artistFolder, fileName]
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.replace(/^\/+|\/+$/g, ''));
  return segments.join('/');
}

// ---------------------------------------------------------------------------
// Deterministic load/save of the registry and attribution table
// ---------------------------------------------------------------------------

function sortByKey(obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return sorted;
}

/** Load data/images.json (returns {} if the file does not exist yet). */
export function loadImages() {
  if (!fs.existsSync(IMAGES_JSON_PATH)) return {};
  const raw = fs.readFileSync(IMAGES_JSON_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/** Load data/attribution.json (returns {} if missing). */
export function loadAttribution() {
  if (!fs.existsSync(ATTRIBUTION_JSON_PATH)) return {};
  const raw = fs.readFileSync(ATTRIBUTION_JSON_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function writeJsonSorted(filePath, obj) {
  const content = JSON.stringify(sortByKey(obj), null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Persist the image registry with keys sorted for clean diffs. */
export function saveImages(images) {
  writeJsonSorted(IMAGES_JSON_PATH, images);
}

/** Persist the attribution table with keys sorted for clean diffs. */
export function saveAttribution(attribution) {
  writeJsonSorted(ATTRIBUTION_JSON_PATH, attribution);
}

/**
 * Build a reverse blobPath -> imageId index over the registry. Throws on a
 * duplicate blobPath, which would mean two ids point at the same file (a
 * corruption the registry must never contain).
 */
export function buildBlobPathIndex(images) {
  const index = new Map();
  for (const [id, rec] of Object.entries(images)) {
    if (!rec || typeof rec.blobPath !== 'string') continue;
    if (index.has(rec.blobPath)) {
      throw new Error(
        `Duplicate blobPath in registry: ${rec.blobPath} (ids ${index.get(rec.blobPath)} and ${id})`
      );
    }
    index.set(rec.blobPath, id);
  }
  return index;
}

/** True if an attribution table is still keyed by blob path (pre-migration). */
export function isBlobPathKeyed(attribution) {
  const keys = Object.keys(attribution);
  if (keys.length === 0) return false;
  // Pre-migration keys are full blob paths ("avatars/..."); post-migration
  // keys are UUIDs. Sampling the first key is enough — the table is uniformly
  // one shape or the other.
  return keys[0].startsWith('avatars/');
}

/**
 * Re-key a blobPath-keyed attribution table onto image ids using the registry
 * index. Returns { attribution, unmapped } where `unmapped` lists any blob
 * paths that had no registry entry (left untouched by the caller's decision).
 */
export function rekeyAttribution(attribution, blobPathIndex) {
  const out = {};
  const unmapped = [];
  for (const [blobPath, record] of Object.entries(attribution)) {
    const id = blobPathIndex.get(blobPath);
    if (!id) {
      unmapped.push(blobPath);
      continue;
    }
    out[id] = record;
  }
  return { attribution: out, unmapped };
}

// ---------------------------------------------------------------------------
// Blob network wrappers (kept thin so unit tests can avoid the network).
// ---------------------------------------------------------------------------

/**
 * List every blob under a prefix, paginating through all pages. Mirrors the
 * cursor loop in assets/migrate-to-blob.mjs. Returns the raw blob objects
 * ({ pathname, url, size, ... }).
 */
export async function listAllBlobs(prefix = 'avatars/') {
  const { list } = await import('@vercel/blob');
  const blobs = [];
  let cursor;
  do {
    const result = await list({ prefix, limit: 1000, cursor });
    blobs.push(...result.blobs);
    cursor = result.cursor;
  } while (cursor);
  return blobs;
}

/**
 * Split a blob path into { iconPath, artistFolder, fileName } using the
 * longest-matching campaign icon_path. Inverse of buildBlobPath(); used by the
 * reattribute tool to recompute a destination path from component overrides.
 * If no campaign matches, iconPath is '' and everything between the prefix and
 * the filename becomes the artistFolder.
 */
export function splitBlobPath(blobPath, campaigns) {
  const rel = blobPath.replace(/^avatars\//, '');
  const segments = rel.split('/');
  const fileName = segments[segments.length - 1];

  let iconPath = '';
  let bestLen = -1;
  for (const c of campaigns) {
    const ip = typeof c.icon_path === 'string' ? c.icon_path : '';
    if (!ip) continue;
    const prefix = ip.endsWith('/') ? ip : `${ip}/`;
    if (rel.startsWith(prefix) && ip.length > bestLen) {
      iconPath = ip;
      bestLen = ip.length;
    }
  }

  const afterIcon = iconPath ? rel.slice(iconPath.length).replace(/^\/+/, '') : rel;
  const afterSegments = afterIcon.split('/');
  afterSegments.pop(); // drop filename
  const artistFolder = afterSegments.join('/');

  return { iconPath, artistFolder, fileName };
}

/** Resolve a campaign's icon_path from its derived id or a raw icon_path. */
export function resolveIconPath(campaignRef, campaigns) {
  for (const c of campaigns) {
    if (campaignSlug(c) === campaignRef || c.icon_path === campaignRef) {
      return typeof c.icon_path === 'string' ? c.icon_path : '';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Blob mutation wrappers (thin; isolated from unit tests).
// ---------------------------------------------------------------------------

/** Upload bytes to a blob path (no random suffix — preserve structure). */
export async function putBlob(blobPath, buffer) {
  const { put } = await import('@vercel/blob');
  return put(blobPath, buffer, { access: 'public', addRandomSuffix: false });
}

/** Resolve a blob's CDN url from its exact pathname, or null if not found. */
export async function getBlobUrl(blobPath) {
  const { list } = await import('@vercel/blob');
  const result = await list({ prefix: blobPath, limit: 1000 });
  const match = result.blobs.find((b) => b.pathname === blobPath);
  return match ? match.url : null;
}

/** Delete a blob by its pathname (resolves the url first). No-op if absent. */
export async function deleteBlob(blobPath) {
  const { del } = await import('@vercel/blob');
  const url = await getBlobUrl(blobPath);
  if (!url) return false;
  await del(url);
  return true;
}

/** Move a blob from one path to another (download -> put new -> delete old). */
export async function moveBlob(oldBlobPath, newBlobPath) {
  const url = await getBlobUrl(oldBlobPath);
  if (!url) throw new Error(`Source blob not found: ${oldBlobPath}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await putBlob(newBlobPath, buffer);
  await deleteBlob(oldBlobPath);
}

/** Make an image-registry record with timestamps stamped to `now`. */
export function makeImageRecord({ blobPath, contentHash, size, campaignId, now }) {
  const ts = now || new Date().toISOString();
  return {
    blobPath,
    contentHash: contentHash ?? null,
    size: typeof size === 'number' ? size : null,
    campaignId: campaignId ?? null,
    status: 'active',
    addedAt: ts,
    updatedAt: ts,
  };
}
