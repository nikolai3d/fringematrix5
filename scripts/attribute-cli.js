#!/usr/bin/env node

/**
 * attribute-cli.js
 *
 * Interactive CLI for manually resolving "unresolved" attribution entries
 * in `data/attribution.json`. Walks every entry where `handle === null`
 * (and where confidence is not the `not-art` sentinel) and prompts for a
 * decision. Saves after every decision so the run is resumable.
 *
 * Usage:
 *   node scripts/attribute-cli.js [--start-at <campaignName>] [--no-open]
 *
 * Flags:
 *   --start-at <campaignName>  Skip entries until the campaign segment of
 *                              the blob path matches <campaignName>. The
 *                              campaign segment is the 2nd path component,
 *                              e.g. for "avatars/Season4/BuildABetterWorld/.."
 *                              the campaign is "BuildABetterWorld".
 *   --no-open                  Don't try to launch the system image viewer.
 *
 * Per-entry choices (single-character input + Enter):
 *   1-9  pick the Nth candidate as the resolved handle
 *   o    type a free-form handle (auto-prefixed with '@' if missing)
 *   n    mark as "not avatar art" (handle stays null, confidence=not-art,
 *        so the entry is not asked about again)
 *   s    skip this entry (no change, move on)
 *   q    quit (save state and exit gracefully)
 *
 * Recorded fields on resolution:
 *   handle      = picked handle (or null for 'n')
 *   confidence  = 'manual' (or 'not-art' for 'n')
 *   method      = 'cli-attribution' (or 'cli-not-art' for 'n')
 *   evidence    = 'manual review YYYY-MM-DD' (or '... — not avatar art')
 *
 * Pure Node. No npm dependencies — uses readline + child_process.spawn only.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is one level up from this script (which lives in scripts/).
const PROJECT_ROOT = path.join(__dirname, '..');
const ATTRIBUTION_PATH = path.join(PROJECT_ROOT, 'data', 'attribution.json');
const BLOB_MIRROR_ROOT = path.join(PROJECT_ROOT, 'downloads', 'all');
const BLOB_KEY_PREFIX = 'avatars/';

/**
 * Tiny manual argv parser — keeps the script dependency-free.
 * Supports the two flags documented in the header. Anything else
 * triggers a usage error so typos don't silently no-op.
 */
function parseArgs(argv) {
  const opts = { startAt: null, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--start-at') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) {
        throw new Error(`--start-at requires a campaign name argument`);
      }
      opts.startAt = v;
      i++;
    } else if (a === '--no-open') {
      opts.open = false;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return opts;
}

function printUsage() {
  console.log(
    [
      'Usage: node scripts/attribute-cli.js [--start-at <campaignName>] [--no-open]',
      '',
      'Walks unresolved entries in data/attribution.json. For each entry:',
      '  1-9  pick the Nth candidate',
      '  o    type a free-form handle',
      '  n    mark as not avatar art (skipped on re-runs)',
      '  s    skip (no change)',
      '  q    quit and save',
    ].join('\n')
  );
}

/**
 * Load the on-disk attribution.json. Returns the parsed object; throws on
 * malformed JSON so we never silently overwrite a broken file.
 */
function loadAttribution() {
  if (!fs.existsSync(ATTRIBUTION_PATH)) {
    throw new Error(`Attribution file not found at ${ATTRIBUTION_PATH}`);
  }
  const raw = fs.readFileSync(ATTRIBUTION_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Write attribution.json back to disk with the same shape used by the
 * import script: 2-space JSON, trailing newline, keys sorted lexically.
 * Sorting keeps diffs minimal even if entries are touched out of order.
 */
function saveAttribution(data) {
  const sorted = {};
  for (const k of Object.keys(data).sort()) {
    sorted[k] = data[k];
  }
  const content = JSON.stringify(sorted, null, 2) + '\n';
  fs.writeFileSync(ATTRIBUTION_PATH, content, 'utf8');
}

/**
 * Extract the campaign segment from a blob key. We expect the shape:
 *   "avatars/SeasonN/CampaignName/.../file.ext"
 * Returns null if the shape doesn't match.
 */
function extractCampaign(blobKey) {
  const parts = blobKey.split('/');
  // ["avatars", "SeasonN", "CampaignName", ...]
  if (parts.length < 3 || parts[0] !== 'avatars') return null;
  return parts[2];
}

/**
 * Map a blob key to its on-disk mirror path. The local mirror is rooted
 * at downloads/all/ and mirrors everything *under* the "avatars/" prefix:
 *   "avatars/Season4/foo/bar.jpg" -> "downloads/all/Season4/foo/bar.jpg"
 */
function blobKeyToLocalPath(blobKey) {
  const stripped = blobKey.startsWith(BLOB_KEY_PREFIX)
    ? blobKey.slice(BLOB_KEY_PREFIX.length)
    : blobKey;
  return path.join(BLOB_MIRROR_ROOT, stripped);
}

/**
 * Attempt to launch the system image viewer for the given path.
 * - macOS:  `open <path>`
 * - Linux:  `xdg-open <path>`
 * - Other:  print the path and return without spawning.
 *
 * Failures are non-fatal: a missing viewer or missing file logs a hint
 * but never aborts the CLI. We detach + ignore stdio so the viewer
 * process doesn't tie our terminal up.
 */
function openImage(localPath) {
  if (!fs.existsSync(localPath)) {
    console.log(`  (image not found on disk at ${localPath})`);
    return;
  }
  let cmd = null;
  if (process.platform === 'darwin') {
    cmd = 'open';
  } else if (process.platform === 'linux') {
    cmd = 'xdg-open';
  }
  if (!cmd) {
    console.log(`  (no auto-open on ${process.platform}; path: ${localPath})`);
    return;
  }
  try {
    const child = spawn(cmd, [localPath], {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', (err) => {
      console.log(`  (failed to launch ${cmd}: ${err.message})`);
    });
    child.unref();
  } catch (err) {
    console.log(`  (failed to launch ${cmd}: ${err.message})`);
  }
}

/**
 * Today's date in YYYY-MM-DD (UTC-agnostic — we just use local components,
 * which matches the existing import-script style of human-readable dates).
 */
function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build a line-reader helper that supports both interactive TTY use and
 * piped stdin (e.g. for scripted runs). We don't use `rl.question` because
 * its callback only fires for the first prompt when input is piped — a
 * long-standing Node.js behavior where subsequent question() calls fail
 * to re-attach a 'line' listener in time. Instead we attach a single
 * 'line' listener and queue lines / waiters ourselves.
 *
 * Returns `{ ask, close }`:
 *   ask(prompt)  — prints prompt and resolves with the next typed line
 *                  (or null on EOF/close, which the caller treats as 'q').
 *   close()      — tears down the readline interface.
 */
function makeLineReader() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => {
    if (waiters.length > 0) {
      waiters.shift()(line);
    } else {
      queue.push(line);
    }
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length > 0) {
      waiters.shift()(null);
    }
  });
  function ask(prompt) {
    process.stdout.write(prompt);
    return new Promise((resolve) => {
      if (queue.length > 0) {
        resolve(queue.shift());
      } else if (closed) {
        resolve(null);
      } else {
        waiters.push(resolve);
      }
    });
  }
  return { ask, close: () => rl.close() };
}

/**
 * True if an entry still counts as "needs resolution" — i.e. handle is
 * null AND the entry hasn't already been marked as not-art. Anything we
 * resolved manually (handle set) or marked not-art is skipped on re-runs.
 */
function isUnresolved(entry) {
  return entry.handle === null && entry.confidence !== 'not-art';
}

/**
 * Drive the interactive loop. Returns when the user quits or runs out of
 * unresolved entries. Mutates `data` in place and writes after each
 * decision via `save()`.
 */
async function runLoop(data, opts) {
  const reader = makeLineReader();
  try {
    return await runLoopWithReader(data, opts, reader);
  } finally {
    reader.close();
  }
}

async function runLoopWithReader(data, opts, reader) {
  const allKeys = Object.keys(data).sort();
  const unresolvedKeys = allKeys.filter((k) => isUnresolved(data[k]));
  const totalUnresolved = unresolvedKeys.length;

  if (totalUnresolved === 0) {
    console.log('No unresolved entries. Nothing to do.');
    return;
  }

  // If --start-at is given, slice the unresolved list until the campaign
  // segment matches. We don't error if no entries match; we just print
  // and exit, since the user may be resuming from a campaign that's
  // already fully resolved.
  let startIndex = 0;
  if (opts.startAt) {
    startIndex = unresolvedKeys.findIndex(
      (k) => extractCampaign(k) === opts.startAt
    );
    if (startIndex < 0) {
      console.log(
        `No unresolved entries found for campaign "${opts.startAt}". Done.`
      );
      return;
    }
  }

  console.log(
    `${totalUnresolved} unresolved entries total. Starting at index ${startIndex + 1}.`
  );
  console.log(
    `Controls: 1-9 pick candidate · o other · n not-art · s skip · q quit`
  );
  console.log('');

  const date = todayIso();

  for (let i = startIndex; i < unresolvedKeys.length; i++) {
    const key = unresolvedKeys[i];
    const entry = data[key];

    // Re-check in case the same key was touched earlier in this run via
    // some other path (defensive — currently we only mutate one at a time).
    if (!isUnresolved(entry)) continue;

    const position = i + 1;
    console.log(`--- ${position} of ${totalUnresolved} unresolved ---`);
    console.log(`Path:     ${key}`);
    const campaign = extractCampaign(key);
    if (campaign) console.log(`Campaign: ${campaign}`);
    const localPath = blobKeyToLocalPath(key);
    console.log(`Local:    ${localPath}`);
    const candidates = Array.isArray(entry.candidates) ? entry.candidates : [];
    if (candidates.length === 0) {
      console.log('Candidates: (none)');
    } else {
      console.log('Candidates:');
      candidates.forEach((c, idx) => {
        console.log(`  ${idx + 1}. ${c}`);
      });
    }
    if (entry.evidence) console.log(`Evidence: ${entry.evidence}`);

    if (opts.open) openImage(localPath);

    const rawAnswer = await reader.ask('Choice [1-9/o/n/s/q]: ');
    if (rawAnswer === null) {
      // EOF on stdin — treat as quit so scripted runs don't hang.
      console.log('\nstdin closed. Progress saved.');
      return;
    }
    const answer = rawAnswer.trim().toLowerCase();

    if (answer === 'q') {
      console.log('Quitting. Progress saved.');
      return;
    }
    if (answer === 's' || answer === '') {
      console.log('Skipped.\n');
      continue;
    }
    if (answer === 'n') {
      entry.handle = null;
      entry.confidence = 'not-art';
      entry.method = 'cli-not-art';
      entry.evidence = `manual review ${date} — not avatar art`;
      saveAttribution(data);
      console.log('Marked as not avatar art.\n');
      continue;
    }
    if (answer === 'o') {
      const rawTyped = await reader.ask('Type handle (e.g. @Foo): ');
      if (rawTyped === null) {
        console.log('\nstdin closed. Progress saved.');
        return;
      }
      const typed = rawTyped.trim();
      if (!typed) {
        console.log('Empty input — skipped.\n');
        continue;
      }
      const handle = typed.startsWith('@') ? typed : `@${typed}`;
      entry.handle = handle;
      entry.confidence = 'manual';
      entry.method = 'cli-attribution';
      entry.evidence = `manual review ${date}`;
      saveAttribution(data);
      console.log(`Set handle to ${handle}.\n`);
      continue;
    }
    // Numbered pick.
    if (/^[1-9]$/.test(answer)) {
      const idx = parseInt(answer, 10) - 1;
      if (idx >= candidates.length) {
        console.log(
          `No candidate at position ${idx + 1} (only ${candidates.length} available). Skipped.\n`
        );
        continue;
      }
      const handle = candidates[idx];
      entry.handle = handle;
      entry.confidence = 'manual';
      entry.method = 'cli-attribution';
      entry.evidence = `manual review ${date}`;
      saveAttribution(data);
      console.log(`Set handle to ${handle}.\n`);
      continue;
    }

    console.log(`Unrecognized input "${answer}". Skipped.\n`);
  }

  console.log('All unresolved entries reviewed.');
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    printUsage();
    process.exit(2);
  }
  if (opts.help) {
    printUsage();
    return;
  }

  const data = loadAttribution();
  await runLoop(data, opts);
}

// Standard "run if invoked directly" guard for ES modules.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  parseArgs,
  extractCampaign,
  blobKeyToLocalPath,
  isUnresolved,
  todayIso,
};
