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
const VALID_LOADING_SCREENS = ['legacy', 'terminal', 'glyphs'];
const MIN_FADE_DELAY = 0;
const MAX_FADE_DELAY = 10000;

// Sidebar animation limits, aligned with client/src/config/lightbox.ts
const SIDEBAR_LIMITS = {
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

let hasErrors = false;

function error(message) {
  console.error(`❌ CONFIG ERROR: ${message}`);
  hasErrors = true;
}

function warn(message) {
  console.warn(`⚠️  CONFIG WARNING: ${message}`);
}

/**
 * Validate a CSS color string.
 * Accepts: hex (#rgb, #rrggbb, #rgba, #rrggbbaa), rgb(), rgba(),
 * hsl(), hsla(), and CSS named colors.
 */
function isValidCssColor(value) {
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

function validateConfig() {
  console.log('🔍 Validating client/config.yaml...');

  let config;
  try {
    const fileContents = readFileSync(CONFIG_PATH, 'utf8');
    config = yaml.load(fileContents, { schema: yaml.JSON_SCHEMA });
  } catch (err) {
    error(`Failed to read or parse config.yaml: ${err.message}`);
    process.exit(1);
  }

  if (!config || typeof config !== 'object') {
    error('config.yaml must be a YAML mapping');
    process.exit(1);
  }

  // ── loadingScreen ────────────────────────────────────────────────────────
  if (!config.loadingScreen || Object.keys(config.loadingScreen).length === 0) {
    error('Missing required section: loadingScreen');
  } else {
    const { loadingScreen } = config;

    // loadingScreen.type
    if (!loadingScreen.type) {
      error('loadingScreen.type is required');
    } else if (!VALID_LOADING_SCREENS.includes(loadingScreen.type)) {
      error(
        `loadingScreen.type must be one of: ${VALID_LOADING_SCREENS.join(', ')}. ` +
        `Got: "${loadingScreen.type}"`
      );
    }

    // loadingScreen.autoFadeDelayMs
    if (loadingScreen.autoFadeDelayMs === undefined || loadingScreen.autoFadeDelayMs === null) {
      warn('loadingScreen.autoFadeDelayMs is not set, will use default (300ms)');
    } else {
      const delay = loadingScreen.autoFadeDelayMs;
      if (typeof delay !== 'number' || isNaN(delay)) {
        error(`loadingScreen.autoFadeDelayMs must be a number. Got: ${typeof delay}`);
      } else if (delay < MIN_FADE_DELAY || delay > MAX_FADE_DELAY) {
        error(
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
      error('theme must be a mapping');
    } else if (theme.accentColor !== undefined) {
      if (!isValidCssColor(theme.accentColor)) {
        error(
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
      error('site must be a mapping');
    } else {
      if (site.url !== undefined) {
        if (typeof site.url !== 'string' || site.url.trim().length === 0) {
          error('site.url must be a non-empty string');
        } else {
          try {
            new URL(site.url);
          } catch {
            error(`site.url must be a valid URL. Got: "${site.url}"`);
          }
        }
      }
      if (site.shareText !== undefined) {
        if (typeof site.shareText !== 'string' || site.shareText.trim().length === 0) {
          error('site.shareText must be a non-empty string');
        }
      }
    }
  }

  // ── lightbox.sidebarAnimation ────────────────────────────────────────────
  if (config.lightbox !== undefined) {
    const { lightbox } = config;
    if (typeof lightbox !== 'object' || lightbox === null) {
      error('lightbox must be a mapping');
    } else if (lightbox.sidebarAnimation !== undefined) {
      const sa = lightbox.sidebarAnimation;
      if (typeof sa !== 'object' || sa === null) {
        error('lightbox.sidebarAnimation must be a mapping');
      } else {
        for (const [field, limits] of Object.entries(SIDEBAR_LIMITS)) {
          const value = sa[field];
          if (value === undefined || value === null) continue; // optional; runtime uses defaults

          if (typeof value !== 'number' || !Number.isFinite(value)) {
            error(
              `lightbox.sidebarAnimation.${field} must be a finite number. Got: "${value}"`
            );
            continue;
          }

          if (limits.integer && !Number.isInteger(value)) {
            error(
              `lightbox.sidebarAnimation.${field} must be an integer. Got: ${value}`
            );
            continue;
          }

          if (value < limits.min || value > limits.max) {
            error(
              `lightbox.sidebarAnimation.${field} must be between ${limits.min}-${limits.max}. ` +
              `Got: ${value}`
            );
          }
        }
      }
    }
  }

  if (hasErrors) {
    console.error('\n❌ Config validation failed. Please fix the errors above.\n');
    process.exit(1);
  } else {
    console.log('✅ Config validation passed!\n');
  }
}

validateConfig();
