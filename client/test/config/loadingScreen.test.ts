import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * config/loadingScreen.ts resolves its exports at import time from
 * `import.meta.env.VITE_LOADING_SCREEN` and client/config.yaml. Each test
 * mocks the YAML module / stubs the env var, resets the module registry and
 * re-imports to exercise the validation + fallback paths.
 */

type YamlShape = { loadingScreen?: { type?: unknown; autoFadeDelayMs?: unknown } };

async function load(yaml: YamlShape, env?: string) {
  vi.resetModules();
  vi.doMock('../../config.yaml', () => ({ default: yaml }));
  vi.stubEnv('VITE_LOADING_SCREEN', env ?? '');
  return import('../../src/config/loadingScreen');
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock('../../config.yaml');
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('LOADING_SCREEN_TYPE', () => {
  it.each(['legacy', 'terminal', 'glyphs'])('accepts "%s" from config.yaml', async (type) => {
    const mod = await load({ loadingScreen: { type } });
    expect(mod.LOADING_SCREEN_TYPE).toBe(type);
    expect(warn).not.toHaveBeenCalled();
  });

  it('defaults to glyphs when config has no loadingScreen block', async () => {
    const mod = await load({});
    expect(mod.LOADING_SCREEN_TYPE).toBe('glyphs');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to glyphs and warns on an invalid config value', async () => {
    const mod = await load({ loadingScreen: { type: 'matrix-rain' } });
    expect(mod.LOADING_SCREEN_TYPE).toBe('glyphs');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid loading screen type: "matrix-rain"'));
  });

  it('VITE_LOADING_SCREEN env var overrides config.yaml', async () => {
    const mod = await load({ loadingScreen: { type: 'glyphs' } }, 'terminal');
    expect(mod.LOADING_SCREEN_TYPE).toBe('terminal');
  });

  it('invalid env var falls back to glyphs (does not fall through to config)', async () => {
    const mod = await load({ loadingScreen: { type: 'legacy' } }, 'bogus');
    expect(mod.LOADING_SCREEN_TYPE).toBe('glyphs');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"bogus"'));
  });
});

describe('LOADING_SCREEN_AUTO_FADE_DELAY_MS', () => {
  it('uses the configured value when in range', async () => {
    const mod = await load({ loadingScreen: { autoFadeDelayMs: 1234 } });
    expect(mod.LOADING_SCREEN_AUTO_FADE_DELAY_MS).toBe(1234);
  });

  it.each([0, 10000])('accepts boundary value %i', async (v) => {
    const mod = await load({ loadingScreen: { autoFadeDelayMs: v } });
    expect(mod.LOADING_SCREEN_AUTO_FADE_DELAY_MS).toBe(v);
    expect(warn).not.toHaveBeenCalled();
  });

  it('defaults to 300 when missing', async () => {
    const mod = await load({ loadingScreen: {} });
    expect(mod.LOADING_SCREEN_AUTO_FADE_DELAY_MS).toBe(300);
    expect(warn).not.toHaveBeenCalled();
  });

  it('defaults to 300 when null', async () => {
    const mod = await load({ loadingScreen: { autoFadeDelayMs: null } });
    expect(mod.LOADING_SCREEN_AUTO_FADE_DELAY_MS).toBe(300);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([['"500"', '500'], ['NaN', Number.NaN]])('warns and defaults for non-number %s', async (_label, v) => {
    const mod = await load({ loadingScreen: { autoFadeDelayMs: v } });
    expect(mod.LOADING_SCREEN_AUTO_FADE_DELAY_MS).toBe(300);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not a number'));
  });

  it.each([-1, 10001])('warns and defaults for out-of-range %i', async (v) => {
    const mod = await load({ loadingScreen: { autoFadeDelayMs: v } });
    expect(mod.LOADING_SCREEN_AUTO_FADE_DELAY_MS).toBe(300);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('must be between 0-10000ms'));
  });
});
