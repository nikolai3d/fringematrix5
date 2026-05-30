#!/usr/bin/env node

/**
 * images-init.mjs — bootstrap / sync the image registry (data/images.json)
 * and perform the one-time re-key of data/attribution.json from blob paths
 * to permanent image ids.
 *
 * Sources of "known" blob paths (unioned):
 *   1. Vercel Blob listing under avatars/ (authoritative, carries size) —
 *      only when BLOB_READ_WRITE_TOKEN is set.
 *   2. Existing data/images.json entries.
 *   3. data/attribution.json keys, while they are still blob-path-keyed
 *      (so the migration never loses an attribution record, even offline).
 *
 * For each known path: keep its id if already registered (refresh size), else
 * assign a fresh UUID + derived campaignId. Content hashes are only computed
 * with --hash (it downloads every blob), otherwise left null for a later pass.
 *
 * Migration: if attribution.json is still blob-path-keyed, re-key every entry
 * onto its registry id, writing data/attribution.json.bak first. Idempotent:
 * a second run with no new blobs is a no-op, and an already-id-keyed
 * attribution table is left untouched.
 *
 * Usage:
 *   node scripts/images-init.mjs [--dry-run] [--hash]
 */

import fs from 'fs';
import {
  loadEnvLocal,
  loadImages,
  saveImages,
  loadAttribution,
  saveAttribution,
  loadCampaigns,
  listAllBlobs,
  buildBlobPathIndex,
  isBlobPathKeyed,
  rekeyAttribution,
  deriveCampaignId,
  generateId,
  hashBytes,
  makeImageRecord,
  isImageFile,
  ATTRIBUTION_JSON_PATH,
} from './lib/image-db.mjs';

function parseArgs(argv) {
  const opts = { dryRun: false, hash: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--hash') opts.hash = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

async function fetchHash(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return hashBytes(buf);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log('Usage: node scripts/images-init.mjs [--dry-run] [--hash]');
    return;
  }

  loadEnvLocal();

  const images = loadImages();
  const attribution = loadAttribution();
  const campaigns = loadCampaigns();
  const existingIndex = buildBlobPathIndex(images);

  // 1. Gather known blob paths (path -> { size, url } where available).
  const known = new Map();
  const addKnown = (blobPath, info = {}) => {
    if (!isImageFile(blobPath)) return;
    const prev = known.get(blobPath) || {};
    known.set(blobPath, { ...prev, ...info });
  };

  let blobListed = 0;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blobs = await listAllBlobs('avatars/');
      for (const b of blobs) addKnown(b.pathname, { size: b.size, url: b.url });
      blobListed = blobs.length;
      console.log(`Listed ${blobListed} blobs from Vercel Blob.`);
    } catch (err) {
      console.warn(`⚠️  Blob listing failed (${err.message}); continuing offline.`);
    }
  } else {
    console.log('ℹ️  No BLOB_READ_WRITE_TOKEN — seeding registry from existing data files only.');
  }

  for (const rec of Object.values(images)) {
    if (rec && typeof rec.blobPath === 'string') addKnown(rec.blobPath);
  }
  const attributionWasBlobKeyed = isBlobPathKeyed(attribution);
  if (attributionWasBlobKeyed) {
    for (const key of Object.keys(attribution)) addKnown(key);
  }

  // 2. Ensure every known path has a registry entry.
  const now = new Date().toISOString();
  let added = 0;
  let refreshed = 0;
  for (const [blobPath, info] of known) {
    const existingId = existingIndex.get(blobPath);
    if (existingId) {
      const rec = images[existingId];
      let changed = false;
      if (typeof info.size === 'number' && rec.size !== info.size) {
        rec.size = info.size;
        changed = true;
      }
      if (opts.hash && info.url) {
        try {
          const h = await fetchHash(info.url);
          if (rec.contentHash !== h) {
            rec.contentHash = h;
            changed = true;
          }
        } catch (err) {
          console.warn(`⚠️  hash ${blobPath}: ${err.message}`);
        }
      }
      if (rec.campaignId == null) {
        rec.campaignId = deriveCampaignId(blobPath, campaigns);
        changed = true;
      }
      if (changed) {
        rec.updatedAt = now;
        refreshed += 1;
      }
      continue;
    }

    let contentHash = null;
    if (opts.hash && info.url) {
      try {
        contentHash = await fetchHash(info.url);
      } catch (err) {
        console.warn(`⚠️  hash ${blobPath}: ${err.message}`);
      }
    }
    const id = generateId();
    images[id] = makeImageRecord({
      blobPath,
      contentHash,
      size: typeof info.size === 'number' ? info.size : null,
      campaignId: deriveCampaignId(blobPath, campaigns),
      now,
    });
    existingIndex.set(blobPath, id);
    added += 1;
  }

  // 3. One-time attribution re-key (blob-path -> id).
  let rekeyed = 0;
  let nextAttribution = attribution;
  if (attributionWasBlobKeyed) {
    const index = buildBlobPathIndex(images);
    const { attribution: rekeyedTable, unmapped } = rekeyAttribution(attribution, index);
    if (unmapped.length > 0) {
      throw new Error(
        `Re-key aborted: ${unmapped.length} attribution path(s) have no registry entry, ` +
          `e.g. ${unmapped.slice(0, 3).join(', ')}`
      );
    }
    nextAttribution = rekeyedTable;
    rekeyed = Object.keys(rekeyedTable).length;
  }

  console.log(
    `Registry: ${Object.keys(images).length} images (${added} added, ${refreshed} refreshed).`
  );
  if (attributionWasBlobKeyed) {
    console.log(`Attribution: re-keyed ${rekeyed} entries onto image ids.`);
  } else {
    console.log('Attribution: already id-keyed — no migration needed.');
  }

  if (opts.dryRun) {
    console.log('🔍 DRY RUN — no files written.');
    return;
  }

  if (attributionWasBlobKeyed) {
    // Back up the pre-migration attribution table before overwriting.
    fs.copyFileSync(ATTRIBUTION_JSON_PATH, `${ATTRIBUTION_JSON_PATH}.bak`);
    console.log(`Wrote ${ATTRIBUTION_JSON_PATH}.bak (pre-migration backup).`);
    saveAttribution(nextAttribution);
  }
  saveImages(images);
  console.log('✅ Done.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('💥 images-init failed:', err.message);
    process.exit(1);
  });
}

export { main };
