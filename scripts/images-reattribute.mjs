#!/usr/bin/env node

/**
 * images-reattribute.mjs — change an image's author and/or its location,
 * keeping the permanent image id (and therefore its attribution link) intact.
 *
 * Because attribution.json is keyed by image id, moving a file to a different
 * artist folder or campaign does NOT touch the attribution record — the id
 * carries the credit with it. That is the whole point of the registry.
 *
 * Usage:
 *   node scripts/images-reattribute.mjs (--id=<imageId> | --path=<blobPath>) [options]
 *
 * Author options (any one):
 *   --handle=@New [--confidence=<high|medium>]   set/replace the author
 *   --unresolved                                 clear the author (unresolved)
 *   --not-art                                    mark as not artwork
 *
 * Location options (any combination):
 *   --to-campaign=<id|icon_path>   move to another campaign
 *   --to-folder=<artistFolder>     change the artist folder
 *   --rename=<fileName>            rename the file
 *
 *   --dry-run
 *
 * Requires BLOB_READ_WRITE_TOKEN for location moves (unless --dry-run).
 */

import {
  loadEnvLocal,
  loadImages,
  saveImages,
  loadAttribution,
  saveAttribution,
  loadCampaigns,
  buildBlobPathIndex,
  buildBlobPath,
  splitBlobPath,
  resolveIconPath,
  deriveCampaignId,
  moveBlob,
} from './lib/image-db.mjs';

function parseArgs(argv) {
  const opts = { dryRun: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--unresolved') opts.unresolved = true;
    else if (arg === '--not-art') opts.notArt = true;
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
  const hasAuthorChange = opts.handle || opts.unresolved || opts.notArt;
  const hasLocationChange = opts['to-campaign'] || opts['to-folder'] || opts.rename;

  if (opts.help || (!opts.id && !opts.path) || (!hasAuthorChange && !hasLocationChange)) {
    console.log(
      'Usage: node scripts/images-reattribute.mjs (--id=<imageId> | --path=<blobPath>)\n' +
        '  author:   --handle=@New [--confidence=high|medium] | --unresolved | --not-art\n' +
        '  location: --to-campaign=<id> --to-folder=<f> --rename=<file>\n' +
        '  [--dry-run]'
    );
    if (!opts.help) process.exitCode = 1;
    return;
  }

  loadEnvLocal();

  const images = loadImages();
  const campaigns = loadCampaigns();
  const index = buildBlobPathIndex(images);

  let id = opts.id;
  if (!id) {
    id = index.get(opts.path);
    if (!id) throw new Error(`No registered image at path: ${opts.path}`);
  }
  const record = images[id];
  if (!record) throw new Error(`No image with id: ${id}`);

  const attribution = loadAttribution();

  // --- Author change -------------------------------------------------------
  let nextAttribution = attribution[id] || null;
  if (hasAuthorChange) {
    const today = new Date().toISOString().slice(0, 10);
    if (opts.handle) {
      nextAttribution = {
        handle: opts.handle,
        confidence: opts.confidence || 'high',
        candidates: [opts.handle],
        method: 'cli-reattribution',
        evidence: `Reattributed to ${opts.handle} via images-reattribute on ${today}`,
      };
    } else if (opts.unresolved) {
      nextAttribution = {
        handle: null,
        confidence: 'unresolved',
        candidates: nextAttribution?.candidates || [],
        method: 'cli-reattribution',
        evidence: `Marked unresolved via images-reattribute on ${today}`,
      };
    } else if (opts.notArt) {
      nextAttribution = {
        handle: null,
        confidence: 'not-art',
        candidates: [],
        method: 'cli-reattribution',
        evidence: `Marked not-art via images-reattribute on ${today}`,
      };
    }
    console.log(`Author -> ${nextAttribution.handle ?? `(${nextAttribution.confidence})`}`);
  }

  // --- Location change -----------------------------------------------------
  let newBlobPath = record.blobPath;
  if (hasLocationChange) {
    const current = splitBlobPath(record.blobPath, campaigns);
    let iconPath = current.iconPath;
    if (opts['to-campaign']) {
      const resolved = resolveIconPath(opts['to-campaign'], campaigns);
      if (resolved === null) throw new Error(`Unknown campaign: ${opts['to-campaign']}`);
      iconPath = resolved;
    }
    newBlobPath = buildBlobPath({
      iconPath,
      artistFolder: opts['to-folder'] !== undefined ? opts['to-folder'] : current.artistFolder,
      fileName: opts.rename || current.fileName,
    });

    if (newBlobPath === record.blobPath) {
      console.log('Location unchanged (computed path equals current).');
    } else if (index.has(newBlobPath)) {
      throw new Error(`Destination already occupied by another image: ${newBlobPath}`);
    } else {
      console.log(`Move -> ${record.blobPath}\n      -> ${newBlobPath}`);
    }
  }

  if (opts.dryRun) {
    console.log('🔍 DRY RUN — nothing moved or written.');
    return;
  }

  // Apply location move (blob first, then registry) so a failed move doesn't
  // leave the registry pointing at a path that does not exist.
  if (hasLocationChange && newBlobPath !== record.blobPath) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required for a location move (or use --dry-run).');
    }
    await moveBlob(record.blobPath, newBlobPath);
    record.blobPath = newBlobPath;
    record.campaignId = deriveCampaignId(newBlobPath, campaigns);
    record.updatedAt = new Date().toISOString();
    saveImages(images);
    console.log('Updated registry blobPath/campaignId.');
  }

  // Apply author change (attribution stays keyed by the unchanged id).
  if (hasAuthorChange && nextAttribution) {
    attribution[id] = nextAttribution;
    saveAttribution(attribution);
    console.log('Updated attribution record.');
  }

  console.log(`✅ Reattributed image ${id}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('💥 images-reattribute failed:', err.message);
    process.exit(1);
  });
}

export { main };
