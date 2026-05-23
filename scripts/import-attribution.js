#!/usr/bin/env node

/**
 * import-attribution.js
 *
 * One-shot import script for the FSRR icon-matrix attribution data.
 *
 * Reads the raw input files at the repo root:
 *   - icon_authors.json     (18 artist records)
 *   - icon_attribution.json (1741 per-image attribution records)
 *
 * Produces two on-disk source-of-truth files under `data/`:
 *   - data/authors.yaml     — keyed list of artists (handle, name,
 *                             twitter_url, alternate_handles, roles, notes)
 *   - data/attribution.json — object keyed by full blob path
 *                             ('avatars/SeasonN/.../file.jpg'); values are
 *                             { handle|null, confidence, candidates[], method, evidence }
 *
 * Path remap: strip the 'FSRR/unified_icon_matrix/' prefix from each
 * `.file` entry. This mapping was previously verified 1:1 against the
 * local `downloads/all/` blob mirror.
 *
 * After a successful write, the raw input files are deleted from the
 * repo root — the on-disk data files become the source of truth.
 *
 * The script is idempotent: running it twice produces identical output.
 *
 * Although this is intended as a one-shot import, the script is kept
 * under `scripts/` for reproducibility / disaster recovery.
 *
 * Acceptance (per bead fringematrix5-kj7):
 *   - `data/authors.yaml` has 18 entries
 *   - `data/attribution.json` has 1741 entries
 *   - `icon_attribution.json` and `icon_authors.json` are gone after run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is one level up from this script (which lives in scripts/)
const PROJECT_ROOT = path.join(__dirname, '..');

const INPUT_AUTHORS = path.join(PROJECT_ROOT, 'icon_authors.json');
const INPUT_ATTRIBUTION = path.join(PROJECT_ROOT, 'icon_attribution.json');

const OUTPUT_AUTHORS = path.join(PROJECT_ROOT, 'data', 'authors.yaml');
const OUTPUT_ATTRIBUTION = path.join(PROJECT_ROOT, 'data', 'attribution.json');

const BLOB_PREFIX = 'FSRR/unified_icon_matrix/';

/**
 * Build the authors.yaml payload from the raw icon_authors.json structure.
 * Discards derivable fields (resolved_folders, images_confidently_attributed,
 * campaigns_with_attributed_art, campaigns_credited, source) — keeping them
 * here would invite drift since they are recomputable from attribution.json.
 */
function buildAuthorsPayload(rawAuthors) {
  const artists = Array.isArray(rawAuthors.artists) ? rawAuthors.artists : [];
  const authors = artists.map((a) => ({
    handle: a.primary_handle,
    name: a.name,
    twitter_url: a.twitter_url,
    alternate_handles: Array.isArray(a.alternate_handles) ? a.alternate_handles : [],
    roles: Array.isArray(a.roles) ? a.roles : [],
    notes: typeof a.note === 'string' ? a.note : '',
  }));
  return { authors };
}

/**
 * Build the attribution.json payload from the raw icon_attribution.json.
 * Keyed by the full blob path used by the API/CDN (i.e. with the
 * 'FSRR/unified_icon_matrix/' prefix stripped). Keys are sorted so future
 * hand-edits produce clean diffs.
 */
function buildAttributionPayload(rawAttribution) {
  const images = Array.isArray(rawAttribution.images) ? rawAttribution.images : [];
  const out = {};
  for (const img of images) {
    const file = img.file;
    if (typeof file !== 'string' || !file.startsWith(BLOB_PREFIX)) {
      throw new Error(
        `Unexpected file path (missing '${BLOB_PREFIX}' prefix): ${file}`
      );
    }
    const key = file.slice(BLOB_PREFIX.length);
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      throw new Error(`Duplicate attribution entry for key: ${key}`);
    }
    out[key] = {
      handle: img.resolved_handle ?? null,
      confidence: img.confidence,
      candidates: Array.isArray(img.candidates) ? img.candidates : [],
      method: img.method,
      evidence: img.evidence,
    };
  }

  // Sort by key for deterministic output.
  const sorted = {};
  for (const k of Object.keys(out).sort()) {
    sorted[k] = out[k];
  }
  return sorted;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeYaml(filePath, payload) {
  // lineWidth: -1 disables line folding so URLs and long strings stay intact;
  // quotingType: '"' keeps strings double-quoted to match the style of
  // existing data/campaigns.yaml.
  const content = yaml.dump(payload, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: true,
    noRefs: true,
  });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath, payload) {
  const content = JSON.stringify(payload, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  if (!fs.existsSync(INPUT_AUTHORS) || !fs.existsSync(INPUT_ATTRIBUTION)) {
    // Idempotent re-run path: if raw inputs are already gone AND outputs exist,
    // we treat this as a no-op success. Otherwise it's a real error.
    const outputsExist =
      fs.existsSync(OUTPUT_AUTHORS) && fs.existsSync(OUTPUT_ATTRIBUTION);
    if (outputsExist && !fs.existsSync(INPUT_AUTHORS) && !fs.existsSync(INPUT_ATTRIBUTION)) {
      console.log(
        'Inputs already removed and outputs already exist — nothing to do (idempotent re-run).'
      );
      return;
    }
    throw new Error(
      `Missing input(s). Expected both:\n  ${INPUT_AUTHORS}\n  ${INPUT_ATTRIBUTION}`
    );
  }

  const rawAuthors = readJson(INPUT_AUTHORS);
  const rawAttribution = readJson(INPUT_ATTRIBUTION);

  const authorsPayload = buildAuthorsPayload(rawAuthors);
  const attributionPayload = buildAttributionPayload(rawAttribution);

  // Ensure the data directory exists (it does in this repo, but be safe).
  fs.mkdirSync(path.dirname(OUTPUT_AUTHORS), { recursive: true });

  writeYaml(OUTPUT_AUTHORS, authorsPayload);
  writeJson(OUTPUT_ATTRIBUTION, attributionPayload);

  const authorsCount = authorsPayload.authors.length;
  const attributionCount = Object.keys(attributionPayload).length;
  console.log(`Wrote ${OUTPUT_AUTHORS} (${authorsCount} authors)`);
  console.log(`Wrote ${OUTPUT_ATTRIBUTION} (${attributionCount} entries)`);

  // Remove raw inputs from repo root now that on-disk data is the source of truth.
  fs.unlinkSync(INPUT_AUTHORS);
  fs.unlinkSync(INPUT_ATTRIBUTION);
  console.log(`Removed ${INPUT_AUTHORS}`);
  console.log(`Removed ${INPUT_ATTRIBUTION}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  buildAuthorsPayload,
  buildAttributionPayload,
  main,
};
