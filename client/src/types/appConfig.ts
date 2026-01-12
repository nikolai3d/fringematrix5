/**
 * Application Configuration Types
 *
 * Defines the structure of client/config.yaml
 */

export type LoadingScreenType = 'legacy' | 'terminal' | 'glyphs';

export interface AppConfig {
  loadingScreen: {
    type: LoadingScreenType;
    autoFadeDelayMs: number;
  };
}
