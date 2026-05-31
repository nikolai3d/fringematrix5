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

/**
 * Pure integrity check over an in-memory registry + attribution table.
 * Returns an array of human-readable problem strings (empty = valid). Kept
 * free of I/O so it is directly unit-testable; main() handles loading, the
 * optional live-Blob cross-check, logging, and the exit code.
 *
 * @param {object} images       registry object (id -> record)
 * @param {object} attribution  attribution table (id -> record)
 * @param {Set<string>|null} presentBlobPaths  when provided, every active
 *        registry blobPath must be in this set (the live-Blob cross-check)
 */
function findProblems(images, attribution, presentBlobPaths = null) {
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
  if (presentBlobPaths) {
    for (const [id, rec] of Object.entries(images)) {
      if (rec && rec.status === 'active' && !presentBlobPaths.has(rec.blobPath)) {
        problems.push(`image ${id}: blob missing in storage (${rec.blobPath})`);
      }
    }
  }

  return problems;
}

async function main() {
  const checkBlob = process.argv.slice(2).includes('--check-blob');
  loadEnvLocal();

  const images = loadImages();
  const attribution = loadAttribution();

  let presentBlobPaths = null;
  if (checkBlob) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('💥 images-validate failed: --check-blob requires BLOB_READ_WRITE_TOKEN');
      process.exit(1);
    }
    const blobs = await listAllBlobs('avatars/');
    presentBlobPaths = new Set(blobs.map((b) => b.pathname));
  }

  const problems = findProblems(images, attribution, presentBlobPaths);

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

export { main, findProblems };
