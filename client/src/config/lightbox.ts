/**
 * Lightbox Configuration
 *
 * Build-time settings for the zoomed-in image view, sourced from
 * client/config.yaml under the `lightbox` key. Validated and clamped here
 * so downstream code can rely on numeric values being in a sane range.
 */

import type { AppConfig, LightboxPanelAnimationConfig } from '../types/appConfig';
import configYaml from '../../config.yaml';

const config = configYaml as AppConfig;

export interface ResolvedPanelAnimation {
  enterDurationMs: number;
  exitDurationMs: number;
  lineHoldMs: number;
  lineBlinkCount: number;
  lineBlinkIntervalMs: number;
  contentFadeInDelayMs: number;
}

const DEFAULTS: ResolvedPanelAnimation = {
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
  value: number | null | undefined,
  field: keyof ResolvedPanelAnimation,
): number {
  const fallback = DEFAULTS[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    console.warn(
      `Invalid lightbox.panelAnimation.${field}: "${value}" (not a finite number). ` +
      `Using default ${fallback}.`,
    );
    return fallback;
  }
  const { min, max } = LIMITS[field];
  if (value < min || value > max) {
    console.warn(
      `Invalid lightbox.panelAnimation.${field}: ${value} (must be between ${min}-${max}). ` +
      `Using default ${fallback}.`,
    );
    return fallback;
  }
  return value;
}

export function resolvePanelAnimation(
  raw: LightboxPanelAnimationConfig | undefined,
): ResolvedPanelAnimation {
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
 * Resolved panel animation timings, ready for consumption by the
 * lightbox animation hook. Falls back to defaults if the
 * `lightbox.panelAnimation` block is missing from config.yaml.
 */
export const LIGHTBOX_PANEL_ANIMATION: ResolvedPanelAnimation =
  resolvePanelAnimation(config.lightbox?.panelAnimation);
