#!/usr/bin/env node

/**
 * images-add.mjs — add a new image to the database.
 *
 * Uploads a local file to Vercel Blob, assigns it a permanent image id, adds a
 * registry entry to data/images.json, and (optionally) writes an attribution
 * record keyed by that id.
 *
 * Usage:
 *   node scripts/images-add.mjs --file=<local> --campaign=<id|icon_path> \
 *       [--artist-folder=<f>] [--name=<file>] [--handle=@artist] \
 *       [--confidence=<high|medium>] [--dry-run] [--force]
 *
 * Requires BLOB_READ_WRITE_TOKEN (unless --dry-run).
 */

import fs from 'fs';
import path from 'path';
import {
  loadEnvLocal,
  loadImages,
  saveImages,
  loadAttribution,
  saveAttribution,
  loadCampaigns,
  buildBlobPathIndex,
  buildBlobPath,
  resolveIconPath,
  deriveCampaignId,
  generateId,
  hashBytes,
  makeImageRecord,
  isImageFile,
  putBlob,
} from './lib/image-db.mjs';

function parseArgs(argv) {
  const opts = { dryRun: false, force: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
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
  if (opts.help || !opts.file || !opts.campaign) {
    console.log(
      'Usage: node scripts/images-add.mjs --file=<local> --campaign=<id|icon_path> ' +
        '[--artist-folder=<f>] [--name=<file>] [--handle=@artist] ' +
        '[--confidence=<high|medium>] [--dry-run] [--force]'
    );
    if (!opts.help) process.exitCode = 1;
    return;
  }

  loadEnvLocal();

  if (!fs.existsSync(opts.file)) throw new Error(`File not found: ${opts.file}`);
  const fileName = opts.name || path.basename(opts.file);
  if (!isImageFile(fileName)) throw new Error(`Not a supported image type: ${fileName}`);

  const campaigns = loadCampaigns();
  const iconPath = resolveIconPath(opts.campaign, campaigns);
  if (iconPath === null) throw new Error(`Unknown campaign: ${opts.campaign}`);

  const blobPath = buildBlobPath({
    iconPath,
    artistFolder: opts['artist-folder'],
    fileName,
  });

  const buffer = fs.readFileSync(opts.file);
  const contentHash = hashBytes(buffer);

  const images = loadImages();
  const index = buildBlobPathIndex(images);

  if (index.has(blobPath) && !opts.force) {
    throw new Error(
      `A registered image already occupies ${blobPath}. Use images-reattribute, or --force.`
    );
  }
  const dup = Object.entries(images).find(
    ([, r]) => r.contentHash && r.contentHash === contentHash && r.status === 'active'
  );
  if (dup && !opts.force) {
    throw new Error(
      `Duplicate content (sha matches image id ${dup[0]} at ${dup[1].blobPath}). Use --force to add anyway.`
    );
  }

  console.log(`Image:    ${opts.file}`);
  console.log(`Target:   ${blobPath} (${buffer.length} bytes)`);
  console.log(`Hash:     ${contentHash}`);
  if (opts.handle) console.log(`Author:   ${opts.handle} (${opts.confidence || 'high'})`);

  if (opts.dryRun) {
    console.log('🔍 DRY RUN — nothing uploaded or written.');
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required to upload (or use --dry-run).');
  }

  await putBlob(blobPath, buffer);

  const id = generateId();
  images[id] = makeImageRecord({
    blobPath,
    contentHash,
    size: buffer.length,
    campaignId: deriveCampaignId(blobPath, campaigns),
  });
  saveImages(images);

  if (opts.handle) {
    const attribution = loadAttribution();
    attribution[id] = {
      handle: opts.handle,
      confidence: opts.confidence || 'high',
      candidates: [opts.handle],
      method: 'cli-add',
      evidence: `Added via images-add on ${new Date().toISOString().slice(0, 10)}`,
    };
    saveAttribution(attribution);
  }

  console.log(`✅ Added image ${id} -> ${blobPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('💥 images-add failed:', err.message);
    process.exit(1);
  });
}

export { main };
