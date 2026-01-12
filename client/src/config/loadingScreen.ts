/**
 * Loading Screen Configuration
 *
 * Configuration priority:
 * 1. VITE_LOADING_SCREEN environment variable (for CI/testing)
 * 2. client/config.yaml loadingScreen.type
 * 3. Default: 'glyphs'
 *
 * Available loading screen types:
 * - 'legacy': Simple "Fringe Matrix 5 Loading..." message
 * - 'terminal': Terminal-style boot sequence with typing animation
 * - 'glyphs': Fringe glyphs rotating on black background
 */

import type { AppConfig, LoadingScreenType } from '../types/appConfig';
import configYaml from '../../config.yaml';

// Re-export the type for convenience
export type { LoadingScreenType } from '../types/appConfig';

/**
 * Represents a step in the terminal loading screen sequence
 */
export interface LoadingStep {
  text: string;
  delay: number; // ms to wait before showing this step
  typeSpeed?: number; // ms per character (default 30)
}

const config = configYaml as AppConfig;

const VALID_LOADING_SCREENS: LoadingScreenType[] = ['legacy', 'terminal', 'glyphs'];

/**
 * Validates and returns a safe loading screen type.
 * Falls back to 'glyphs' if the value is invalid.
 */
function validateLoadingScreenType(value: string | undefined): LoadingScreenType {
  if (!value) {
    return 'glyphs';
  }

  if (VALID_LOADING_SCREENS.includes(value as LoadingScreenType)) {
    return value as LoadingScreenType;
  }

  console.warn(
    `Invalid loading screen type: "${value}". ` +
    `Valid options are: ${VALID_LOADING_SCREENS.join(', ')}. ` +
    `Falling back to 'glyphs'.`
  );
  return 'glyphs';
}

/**
 * Get the loading screen type from environment variable or config.
 * VITE_LOADING_SCREEN env var takes precedence over config.yaml.
 */
function getLoadingScreenType(): LoadingScreenType {
  // Check environment variable first (for CI/testing)
  const envValue = import.meta.env.VITE_LOADING_SCREEN;
  if (envValue) {
    return validateLoadingScreenType(envValue);
  }

  // Fall back to config.yaml
  return validateLoadingScreenType(config.loadingScreen?.type);
}

/**
 * The currently configured loading screen type.
 * Priority: VITE_LOADING_SCREEN env var > config.yaml > 'glyphs' default
 */
export const LOADING_SCREEN_TYPE: LoadingScreenType = getLoadingScreenType();

/**
 * Delay in milliseconds before the loading screen auto-fades to the main content.
 * This is the time between when data is ready and when the transition begins.
 * Configured in client/config.yaml under loadingScreen.autoFadeDelayMs
 */
export const LOADING_SCREEN_AUTO_FADE_DELAY_MS: number =
  config.loadingScreen?.autoFadeDelayMs ?? 300;
