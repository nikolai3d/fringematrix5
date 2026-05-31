#!/usr/bin/env node

/**
 * images-delete.mjs — delete an image from the database.
 *
 * Removes the blob from Vercel Blob (unless --keep-blob), the registry entry
 * from data/images.json, and the attribution record (by image id) from
 * data/attribution.json.
 *
 * Usage:
 *   node scripts/images-delete.mjs (--id=<imageId> | --path=<blobPath>) \
 *       [--keep-blob] [--dry-run]
 *
 * Requires BLOB_READ_WRITE_TOKEN unless --keep-blob or --dry-run.
 */

import {
  loadEnvLocal,
  loadImages,
  saveImages,
  loadAttribution,
  saveAttribution,
  buildBlobPathIndex,
  deleteBlob,
} from './lib/image-db.mjs';

function parseArgs(argv) {
  const opts = { dryRun: false, keepBlob: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--keep-blob') opts.keepBlob = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--')) {
      const [k, ...v] = arg.slice(2).split('=');
      opts[k] = v.length ? v.join('=') : true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help || (!opts.id && !opts.path)) {
    console.log(
      'Usage: node scripts/images-delete.mjs (--id=<imageId> | --path=<blobPath>) [--keep-blob] [--dry-run]'
    );
    if (!opts.help) process.exitCode = 1;
    return;
  }

  loadEnvLocal();

  const images = loadImages();
  let id = opts.id;
  if (!id) {
    const index = buildBlobPathIndex(images);
    id = index.get(opts.path);
    if (!id) throw new Error(`No registered image at path: ${opts.path}`);
  }
  const record = images[id];
  if (!record) throw new Error(`No image with id: ${id}`);

  console.log(`Deleting image ${id} -> ${record.blobPath}`);
  console.log(opts.keepBlob ? 'Keeping blob (registry/attribution only).' : 'Will delete blob.');

  if (opts.dryRun) {
    console.log('🔍 DRY RUN — nothing deleted or written.');
    return;
  }

  if (!opts.keepBlob) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required to delete the blob (or use --keep-blob).');
    }
    const deleted = await deleteBlob(record.blobPath);
    console.log(deleted ? `Deleted blob ${record.blobPath}` : `Blob not found (already gone).`);
  }

  delete images[id];
  saveImages(images);

  const attribution = loadAttribution();
  if (attribution[id]) {
    delete attribution[id];
    saveAttribution(attribution);
    console.log('Removed attribution record.');
  }

  console.log(`✅ Deleted image ${id}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('💥 images-delete failed:', err.message);
    process.exit(1);
  });
}

export { main };
