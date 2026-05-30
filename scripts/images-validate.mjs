#!/usr/bin/env node

/**
 * images-validate.mjs — integrity check for the image database.
 *
 * Asserts:
 *   - every attribution key is a known image id present in data/images.json
 *   - image ids and blobPaths are unique in the registry
 *   - every registry record has the required fields and a valid status
 *   - (with --check-blob) every active registry blobPath exists in Vercel Blob
 *
 * Exits non-zero if any problem is found, so it can gate CI.
 *
 * Usage:
 *   node scripts/images-validate.mjs [--check-blob]
 */

import {
  loadEnvLocal,
  loadImages,
  loadAttribution,
  isBlobPathKeyed,
  listAllBlobs,
} from './lib/image-db.mjs';

const VALID_STATUS = new Set(['active', 'deleted']);

async function main() {
  const checkBlob = process.argv.slice(2).includes('--check-blob');
  loadEnvLocal();

  const images = loadImages();
  const attribution = loadAttribution();
  const problems = [];

  // Registry shape + uniqueness.
  const seenBlobPaths = new Map();
  for (const [id, rec] of Object.entries(images)) {
    if (!rec || typeof rec !== 'object') {
      problems.push(`image ${id}: not an object`);
      continue;
    }
    if (typeof rec.blobPath !== 'string' || !rec.blobPath) {
      problems.push(`image ${id}: missing blobPath`);
    } else if (seenBlobPaths.has(rec.blobPath)) {
      problems.push(`duplicate blobPath ${rec.blobPath}: ids ${seenBlobPaths.get(rec.blobPath)} and ${id}`);
    } else {
      seenBlobPaths.set(rec.blobPath, id);
    }
    if (!VALID_STATUS.has(rec.status)) {
      problems.push(`image ${id}: invalid status ${JSON.stringify(rec.status)}`);
    }
  }

  // Attribution must be id-keyed and every key must resolve to a registry entry.
  if (isBlobPathKeyed(attribution)) {
    problems.push(
      'attribution.json is still blob-path-keyed — run scripts/images-init.mjs to migrate.'
    );
  } else {
    for (const key of Object.keys(attribution)) {
      if (!Object.prototype.hasOwnProperty.call(images, key)) {
        problems.push(`attribution key has no registry entry: ${key}`);
      }
    }
  }

  // Optional cross-check against live Blob.
  if (checkBlob) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      problems.push('--check-blob requires BLOB_READ_WRITE_TOKEN');
    } else {
      const blobs = await listAllBlobs('avatars/');
      const present = new Set(blobs.map((b) => b.pathname));
      for (const [id, rec] of Object.entries(images)) {
        if (rec.status === 'active' && !present.has(rec.blobPath)) {
          problems.push(`image ${id}: blob missing in storage (${rec.blobPath})`);
        }
      }
    }
  }

  console.log(`Registry: ${Object.keys(images).length} images`);
  console.log(`Attribution: ${Object.keys(attribution).length} records`);

  if (problems.length > 0) {
    console.error(`\n❌ ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 50)) console.error(`  - ${p}`);
    if (problems.length > 50) console.error(`  ... and ${problems.length - 50} more`);
    process.exit(1);
  }
  console.log('✅ Image database is valid.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('💥 images-validate failed:', err.message);
    process.exit(1);
  });
}

export { main };
