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

export const LOADING_SCREEN_TYPE: LoadingScreenType =
  (import.meta.env.VITE_LOADING_SCREEN as LoadingScreenType) || 'terminal';
