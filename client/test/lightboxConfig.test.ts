/**
 * Test surface: confirms the bundled lightbox sidebar animation timings
 * are valid numbers within the expected clamping range. The exact values
 * are sourced from client/config.yaml at build time.
 *
 * Also tests the resolveSidebarAnimation resolver directly with invalid,
 * out-of-range, and partial inputs to verify fallback-to-default behaviour.
 */
import { describe, it, expect, vi } from 'vitest';
import { LIGHTBOX_SIDEBAR_ANIMATION, resolveSidebarAnimation } from '../src/config/lightbox';

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

describe('resolveSidebarAnimation — fallback to defaults', () => {
  it('returns all defaults when called with undefined (block missing from config)', () => {
    const result = resolveSidebarAnimation(undefined);
    expect(result).toEqual({
      enterDurationMs: 420,
      exitDurationMs: 320,
      lineHoldMs: 120,
      lineBlinkCount: 2,
      lineBlinkIntervalMs: 90,
      contentFadeInDelayMs: 180,
    });
  });

  it('returns all defaults when called with an empty object (all fields missing)', () => {
    const result = resolveSidebarAnimation({});
    expect(result).toEqual({
      enterDurationMs: 420,
      exitDurationMs: 320,
      lineHoldMs: 120,
      lineBlinkCount: 2,
      lineBlinkIntervalMs: 90,
      contentFadeInDelayMs: 180,
    });
  });

  it('falls back per-field when only some fields are present (partial config)', () => {
    const result = resolveSidebarAnimation({ enterDurationMs: 500, exitDurationMs: 400 });
    expect(result.enterDurationMs).toBe(500);
    expect(result.exitDurationMs).toBe(400);
    // Unspecified fields use defaults
    expect(result.lineHoldMs).toBe(120);
    expect(result.lineBlinkCount).toBe(2);
    expect(result.lineBlinkIntervalMs).toBe(90);
    expect(result.contentFadeInDelayMs).toBe(180);
  });
});

describe('resolveSidebarAnimation — invalid type inputs', () => {
  it('falls back to default and warns when a field is a non-finite number (NaN)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveSidebarAnimation({ enterDurationMs: NaN });
    expect(result.enterDurationMs).toBe(420);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('enterDurationMs'));
    warnSpy.mockRestore();
  });

  it('falls back to default and warns when a field is Infinity', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveSidebarAnimation({ exitDurationMs: Infinity });
    expect(result.exitDurationMs).toBe(320);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exitDurationMs'));
    warnSpy.mockRestore();
  });

  it('falls back to default and warns when a field is a string', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Cast through unknown to simulate a misconfigured YAML value reaching the resolver
    const result = resolveSidebarAnimation({ lineHoldMs: 'fast' as unknown as number });
    expect(result.lineHoldMs).toBe(120);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lineHoldMs'));
    warnSpy.mockRestore();
  });
});

describe('resolveSidebarAnimation — out-of-range inputs', () => {
  it('falls back to default and warns when enterDurationMs exceeds max (2000)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveSidebarAnimation({ enterDurationMs: 9999 });
    expect(result.enterDurationMs).toBe(420);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('enterDurationMs'));
    warnSpy.mockRestore();
  });

  it('falls back to default and warns when exitDurationMs is negative', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveSidebarAnimation({ exitDurationMs: -1 });
    expect(result.exitDurationMs).toBe(320);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exitDurationMs'));
    warnSpy.mockRestore();
  });

  it('falls back to default and warns when lineBlinkIntervalMs is below min (10)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveSidebarAnimation({ lineBlinkIntervalMs: 5 });
    expect(result.lineBlinkIntervalMs).toBe(90);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lineBlinkIntervalMs'));
    warnSpy.mockRestore();
  });

  it('falls back to default and warns when lineBlinkCount exceeds max (10)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveSidebarAnimation({ lineBlinkCount: 100 });
    expect(result.lineBlinkCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lineBlinkCount'));
    warnSpy.mockRestore();
  });

  it('accepts boundary values (min/max) without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveSidebarAnimation({
      enterDurationMs: 0,
      exitDurationMs: 2000,
      lineHoldMs: 0,
      lineBlinkCount: 0,
      lineBlinkIntervalMs: 10,
      contentFadeInDelayMs: 2000,
    });
    expect(result.enterDurationMs).toBe(0);
    expect(result.exitDurationMs).toBe(2000);
    expect(result.lineHoldMs).toBe(0);
    expect(result.lineBlinkCount).toBe(0);
    expect(result.lineBlinkIntervalMs).toBe(10);
    expect(result.contentFadeInDelayMs).toBe(2000);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
