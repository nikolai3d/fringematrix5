#!/usr/bin/env node

/**
 * Validates client/config.yaml to ensure it has valid structure and values.
 * This runs during the build process to catch configuration errors early.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = resolve(__dirname, '../client/config.yaml');
const VALID_LOADING_SCREENS = ['legacy', 'terminal', 'glyphs'];
const MIN_FADE_DELAY = 0;
const MAX_FADE_DELAY = 10000;

let hasErrors = false;

function error(message) {
  console.error(`❌ CONFIG ERROR: ${message}`);
  hasErrors = true;
}

function warn(message) {
  console.warn(`⚠️  CONFIG WARNING: ${message}`);
}

/**
 * Simple YAML parser for our specific config structure.
 * Supports only the subset we need: key-value pairs with indentation.
 */
function parseSimpleYaml(yamlContent) {
  const lines = yamlContent.split('\n');
  const config = { loadingScreen: {} };
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Detect top-level keys (no leading whitespace, ends with colon)
    if (!line.startsWith(' ') && trimmed.match(/^(\w+):$/)) {
      // Check if it's the loadingScreen section
      if (trimmed === 'loadingScreen:') {
        currentSection = 'loadingScreen';
      } else {
        // Reset currentSection for any other top-level key
        currentSection = null;
      }
      continue;
    }

    // Parse key-value pairs under loadingScreen
    if (currentSection === 'loadingScreen' && line.startsWith('  ')) {
      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const [, key, rawValue] = match;

        // Strip surrounding quotes (single or double) from value
        let value = rawValue.trim();
        if (value === '') {
          error(`Missing value for loadingScreen.${key}`);
          continue;
        }
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Try to parse as number
        const numValue = Number(value);
        config.loadingScreen[key] = isNaN(numValue) ? value : numValue;
      }
    }
  }

  return config;
}

function validateConfig() {
  console.log('🔍 Validating client/config.yaml...');

  let config;
  try {
    const fileContents = readFileSync(CONFIG_PATH, 'utf8');
    config = parseSimpleYaml(fileContents);
  } catch (err) {
    error(`Failed to read config.yaml: ${err.message}`);
    process.exit(1);
  }

  // Validate loadingScreen section exists
  if (!config.loadingScreen || Object.keys(config.loadingScreen).length === 0) {
    error('Missing required section: loadingScreen');
  } else {
    const { loadingScreen } = config;

    // Validate loadingScreen.type
    if (!loadingScreen.type) {
      error('loadingScreen.type is required');
    } else if (!VALID_LOADING_SCREENS.includes(loadingScreen.type)) {
      error(
        `loadingScreen.type must be one of: ${VALID_LOADING_SCREENS.join(', ')}. ` +
        `Got: "${loadingScreen.type}"`
      );
    }

    // Validate loadingScreen.autoFadeDelayMs
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

  if (hasErrors) {
    console.error('\n❌ Config validation failed. Please fix the errors above.\n');
    process.exit(1);
  } else {
    console.log('✅ Config validation passed!\n');
  }
}

validateConfig();
