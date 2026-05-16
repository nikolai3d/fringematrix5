/**
 * Test surface: confirms the bundled lightbox sidebar animation timings
 * are valid numbers within the expected clamping range. The exact values
 * are sourced from client/config.yaml at build time.
 */
import { describe, it, expect } from 'vitest';
import { LIGHTBOX_SIDEBAR_ANIMATION } from '../src/config/lightbox';

describe('LIGHTBOX_SIDEBAR_ANIMATION (resolved from config.yaml)', () => {
  it('exposes all sidebar animation timing fields as finite numbers', () => {
    const fields = [
      'enterDurationMs',
      'exitDurationMs',
      'lineHoldMs',
      'lineBlinkCount',
      'lineBlinkIntervalMs',
      'contentFadeInDelayMs',
    ] as const;
    for (const field of fields) {
      const value = LIGHTBOX_SIDEBAR_ANIMATION[field];
      expect(typeof value).toBe('number');
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('lineHold fits inside enterDuration so the expand phase has time to run', () => {
    expect(LIGHTBOX_SIDEBAR_ANIMATION.lineHoldMs)
      .toBeLessThanOrEqual(LIGHTBOX_SIDEBAR_ANIMATION.enterDurationMs);
  });
});
