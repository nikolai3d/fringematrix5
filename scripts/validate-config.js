#!/usr/bin/env node

/**
 * Validates client/config.yaml to ensure it has valid structure and values.
 * This runs during the build process to catch configuration errors early.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = resolve(__dirname, '../client/config.yaml');
export const VALID_LOADING_SCREENS = ['legacy', 'terminal', 'glyphs'];
export const MIN_FADE_DELAY = 0;
export const MAX_FADE_DELAY = 10000;

// Sidebar animation limits, aligned with client/src/config/lightbox.ts
export const SIDEBAR_LIMITS = {
  enterDurationMs:       { min: 0,  max: 2000, integer: false },
  exitDurationMs:        { min: 0,  max: 2000, integer: false },
  lineHoldMs:            { min: 0,  max: 1000, integer: false },
  lineBlinkCount:        { min: 0,  max: 10,   integer: true  },
  lineBlinkIntervalMs:   { min: 10, max: 1000, integer: false },
  contentFadeInDelayMs:  { min: 0,  max: 2000, integer: false },
};

// CSS named colors (common subset + 'transparent') — module-level to avoid re-allocation
const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'inherit', 'initial', 'unset',
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
  'purple', 'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta',
  'lime', 'olive', 'teal', 'navy', 'maroon', 'aqua', 'fuchsia',
  'silver', 'gold', 'indigo', 'violet', 'coral', 'salmon', 'khaki',
  'lavender', 'beige', 'ivory', 'crimson', 'turquoise', 'sienna',
  'tan', 'plum', 'orchid', 'peru', 'tomato', 'wheat', 'linen',
]);

/**
 * Validate a CSS color string.
 * Accepts: hex (#rgb, #rrggbb, #rgba, #rrggbbaa), rgb(), rgba(),
 * hsl(), hsla(), and CSS named colors.
 */
export function isValidCssColor(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();

  // Hex colors: #rgb, #rrggbb, #rgba, #rrggbbaa
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return true;
  }

  // rgb() / rgba()
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return true;
  }

  // hsl() / hsla()
  if (/^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return true;
  }

  return NAMED_COLORS.has(trimmed.toLowerCase());
}

/**
 * Validate a parsed config object.
 *
 * @param {object} config - The parsed YAML config object.
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateConfigObject(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object') {
    errors.push('config.yaml must be a YAML mapping');
    return { errors, warnings };
  }

  // ── loadingScreen ────────────────────────────────────────────────────────
  if (!config.loadingScreen || Object.keys(config.loadingScreen).length === 0) {
    errors.push('Missing required section: loadingScreen');
  } else {
    const { loadingScreen } = config;

    // loadingScreen.type
    if (!loadingScreen.type) {
      errors.push('loadingScreen.type is required');
    } else if (!VALID_LOADING_SCREENS.includes(loadingScreen.type)) {
      errors.push(
        `loadingScreen.type must be one of: ${VALID_LOADING_SCREENS.join(', ')}. ` +
        `Got: "${loadingScreen.type}"`
      );
    }

    // loadingScreen.autoFadeDelayMs
    if (loadingScreen.autoFadeDelayMs === undefined || loadingScreen.autoFadeDelayMs === null) {
      warnings.push('loadingScreen.autoFadeDelayMs is not set, will use default (300ms)');
    } else {
      const delay = loadingScreen.autoFadeDelayMs;
      if (typeof delay !== 'number' || isNaN(delay)) {
        errors.push(`loadingScreen.autoFadeDelayMs must be a number. Got: ${typeof delay}`);
      } else if (delay < MIN_FADE_DELAY || delay > MAX_FADE_DELAY) {
        errors.push(
          `loadingScreen.autoFadeDelayMs must be between ${MIN_FADE_DELAY}-${MAX_FADE_DELAY}ms. ` +
          `Got: ${delay}ms`
        );
      }
    }
  }

  // ── theme ────────────────────────────────────────────────────────────────
  if (config.theme !== undefined) {
    const { theme } = config;
    if (typeof theme !== 'object' || theme === null) {
      errors.push('theme must be a mapping');
    } else if (theme.accentColor !== undefined) {
      if (!isValidCssColor(theme.accentColor)) {
        errors.push(
          `theme.accentColor must be a valid CSS color (hex, rgb(), hsl(), or named color). ` +
          `Got: "${theme.accentColor}"`
        );
      }
    }
  }

  // ── site ────────────────────────────────────────────────────────────────
  if (config.site !== undefined) {
    const { site } = config;
    if (typeof site !== 'object' || site === null) {
      errors.push('site must be a mapping');
    } else {
      if (site.url !== undefined) {
        if (typeof site.url !== 'string' || site.url.trim().length === 0) {
          errors.push('site.url must be a non-empty string');
        } else {
          try {
            new URL(site.url);
          } catch {
            errors.push(`site.url must be a valid URL. Got: "${site.url}"`);
          }
        }
      }
      if (site.shareText !== undefined) {
        if (typeof site.shareText !== 'string' || site.shareText.trim().length === 0) {
          errors.push('site.shareText must be a non-empty string');
        }
      }
    }
  }

  // ── lightbox.sidebarAnimation ────────────────────────────────────────────
  if (config.lightbox !== undefined) {
    const { lightbox } = config;
    if (typeof lightbox !== 'object' || lightbox === null) {
      errors.push('lightbox must be a mapping');
    } else if (lightbox.sidebarAnimation !== undefined) {
      const sa = lightbox.sidebarAnimation;
      if (typeof sa !== 'object' || sa === null) {
        errors.push('lightbox.sidebarAnimation must be a mapping');
      } else {
        for (const [field, limits] of Object.entries(SIDEBAR_LIMITS)) {
          const value = sa[field];
          if (value === undefined || value === null) continue; // optional; runtime uses defaults

          if (typeof value !== 'number' || !Number.isFinite(value)) {
            errors.push(
              `lightbox.sidebarAnimation.${field} must be a finite number. Got: "${value}"`
            );
            continue;
          }

          if (limits.integer && !Number.isInteger(value)) {
            errors.push(
              `lightbox.sidebarAnimation.${field} must be an integer. Got: ${value}`
            );
            continue;
          }

          if (value < limits.min || value > limits.max) {
            errors.push(
              `lightbox.sidebarAnimation.${field} must be between ${limits.min}-${limits.max}. ` +
              `Got: ${value}`
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
}

function runCli() {
  console.log('🔍 Validating client/config.yaml...');

  let config;
  try {
    const fileContents = readFileSync(CONFIG_PATH, 'utf8');
    config = yaml.load(fileContents, { schema: yaml.JSON_SCHEMA });
  } catch (err) {
    console.error(`❌ CONFIG ERROR: Failed to read or parse config.yaml: ${err.message}`);
    process.exit(1);
  }

  const { errors, warnings } = validateConfigObject(config);

  for (const w of warnings) {
    console.warn(`⚠️  CONFIG WARNING: ${w}`);
  }
  for (const e of errors) {
    console.error(`❌ CONFIG ERROR: ${e}`);
  }

  if (errors.length > 0) {
    console.error('\n❌ Config validation failed. Please fix the errors above.\n');
    process.exit(1);
  } else {
    console.log('✅ Config validation passed!\n');
  }
}

// Only run the CLI when this file is the entry point (not when imported by tests).
// In ESM there is no require.main; compare import.meta.url to process.argv[1].
const isMain = process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  runCli();
}
