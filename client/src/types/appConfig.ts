/**
 * Application Configuration Types
 *
 * Defines the structure of client/config.yaml
 */

export type LoadingScreenType = 'legacy' | 'terminal' | 'glyphs';

export interface ThemeConfig {
  accentColor?: string;
}

export interface LightboxSidebarAnimationConfig {
  enterDurationMs?: number;
  exitDurationMs?: number;
  lineHoldMs?: number;
  lineBlinkCount?: number;
  lineBlinkIntervalMs?: number;
  contentFadeInDelayMs?: number;
}

export interface LightboxConfig {
  sidebarAnimation?: LightboxSidebarAnimationConfig;
}

export interface AppConfig {
  loadingScreen?: {
    type?: LoadingScreenType;
    autoFadeDelayMs?: number;
  };
  theme?: ThemeConfig;
  lightbox?: LightboxConfig;
}
