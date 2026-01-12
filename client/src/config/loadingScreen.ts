/**
 * Loading Screen Configuration
 *
 * Controls which loading screen is displayed during app initialization.
 * Can be set via VITE_LOADING_SCREEN environment variable.
 *
 * Available options:
 * - 'legacy': Simple "Fringe Matrix 5 Loading..." message
 * - 'terminal': Terminal-style boot sequence with typing animation (default)
 * - 'glyphs': Fringe glyphs rotating on black background
 */

export type LoadingScreenType = 'legacy' | 'terminal' | 'glyphs';

/**
 * Represents a step in the terminal loading screen sequence
 */
export interface LoadingStep {
  text: string;
  delay: number; // ms to wait before showing this step
  typeSpeed?: number; // ms per character (default 30)
}

const VALID_LOADING_SCREENS: LoadingScreenType[] = ['legacy', 'terminal', 'glyphs'];

/**
 * Validates and returns a safe loading screen type.
 * Falls back to 'terminal' if the environment variable is invalid.
 */
function validateLoadingScreenType(value: string | undefined): LoadingScreenType {
  if (!value) {
    return 'glyphs';
  }

  if (VALID_LOADING_SCREENS.includes(value as LoadingScreenType)) {
    return value as LoadingScreenType;
  }

  console.warn(
    `Invalid VITE_LOADING_SCREEN value: "${value}". ` +
    `Valid options are: ${VALID_LOADING_SCREENS.join(', ')}. ` +
    `Falling back to 'glyphs'.`
  );
  return 'glyphs';
}

export const LOADING_SCREEN_TYPE: LoadingScreenType =
  validateLoadingScreenType(import.meta.env.VITE_LOADING_SCREEN);
