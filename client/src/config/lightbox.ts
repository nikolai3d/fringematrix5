/**
 * Lightbox Configuration
 *
 * Build-time settings for the zoomed-in image view, sourced from
 * client/config.yaml under the `lightbox` key. Validated and clamped here
 * so downstream code can rely on numeric values being in a sane range.
 */

import type { AppConfig, LightboxSidebarAnimationConfig } from '../types/appConfig';
import configYaml from '../../config.yaml';

const config = configYaml as AppConfig;

export interface ResolvedSidebarAnimation {
  enterDurationMs: number;
  exitDurationMs: number;
  lineHoldMs: number;
  lineBlinkCount: number;
  lineBlinkIntervalMs: number;
  contentFadeInDelayMs: number;
}

const DEFAULTS: ResolvedSidebarAnimation = {
  enterDurationMs: 420,
  exitDurationMs: 320,
  lineHoldMs: 120,
  lineBlinkCount: 2,
  lineBlinkIntervalMs: 90,
  contentFadeInDelayMs: 180,
};

// Generous upper bounds. The lightbox open/close path is interactive, so
// runaway values (e.g. enterDurationMs: 10_000) would freeze the UI — clamp
// before the animation hook reads them.
const LIMITS = {
  enterDurationMs: { min: 0, max: 2000 },
  exitDurationMs: { min: 0, max: 2000 },
  lineHoldMs: { min: 0, max: 1000 },
  lineBlinkCount: { min: 0, max: 10 },
  lineBlinkIntervalMs: { min: 10, max: 1000 },
  contentFadeInDelayMs: { min: 0, max: 2000 },
} as const;

function pickNumber(
  value: number | undefined,
  field: keyof ResolvedSidebarAnimation,
): number {
  const fallback = DEFAULTS[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    console.warn(
      `Invalid lightbox.sidebarAnimation.${field}: "${value}" (not a finite number). ` +
      `Using default ${fallback}.`,
    );
    return fallback;
  }
  const { min, max } = LIMITS[field];
  if (value < min || value > max) {
    console.warn(
      `Invalid lightbox.sidebarAnimation.${field}: ${value} (must be between ${min}-${max}). ` +
      `Using default ${fallback}.`,
    );
    return fallback;
  }
  return value;
}

function resolveSidebarAnimation(
  raw: LightboxSidebarAnimationConfig | undefined,
): ResolvedSidebarAnimation {
  return {
    enterDurationMs: pickNumber(raw?.enterDurationMs, 'enterDurationMs'),
    exitDurationMs: pickNumber(raw?.exitDurationMs, 'exitDurationMs'),
    lineHoldMs: pickNumber(raw?.lineHoldMs, 'lineHoldMs'),
    lineBlinkCount: pickNumber(raw?.lineBlinkCount, 'lineBlinkCount'),
    lineBlinkIntervalMs: pickNumber(raw?.lineBlinkIntervalMs, 'lineBlinkIntervalMs'),
    contentFadeInDelayMs: pickNumber(raw?.contentFadeInDelayMs, 'contentFadeInDelayMs'),
  };
}

/**
 * Resolved sidebar animation timings, ready for consumption by the
 * lightbox sidebar animation hook. Falls back to defaults if the
 * `lightbox.sidebarAnimation` block is missing from config.yaml.
 */
export const LIGHTBOX_SIDEBAR_ANIMATION: ResolvedSidebarAnimation =
  resolveSidebarAnimation(config.lightbox?.sidebarAnimation);
