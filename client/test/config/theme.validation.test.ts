import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * THEME_ACCENT_COLOR is validated at import time from client/config.yaml.
 * Mock the YAML module and re-import to exercise each validation branch,
 * then verify applyTheme() writes the derived CSS custom properties.
 */

async function load(yaml: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('../../config.yaml', () => ({ default: yaml }));
  return import('../../src/config/theme');
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock('../../config.yaml');
  vi.restoreAllMocks();
  vi.resetModules();
  const root = document.documentElement;
  ['--theme-accent', '--theme-accent-rgb', '--theme-glow', '--theme-glow-rgb'].forEach((p) =>
    root.style.removeProperty(p),
  );
});

describe('THEME_ACCENT_COLOR validation', () => {
  it('defaults to #00D4FF when theme block is missing', async () => {
    const mod = await load({});
    expect(mod.THEME_ACCENT_COLOR).toBe('#00D4FF');
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts a 6-digit color with #', async () => {
    const mod = await load({ theme: { accentColor: '#FF2E8B' } });
    expect(mod.THEME_ACCENT_COLOR).toBe('#FF2E8B');
  });

  it('adds a # prefix when missing', async () => {
    const mod = await load({ theme: { accentColor: 'abc' } });
    expect(mod.THEME_ACCENT_COLOR).toBe('#abc');
  });

  it.each(['#12345', '#GGGGGG', 'red', '#00D4FF80', '#abcd'])(
    'rejects invalid "%s", warns and uses the default',
    async (value) => {
      const mod = await load({ theme: { accentColor: value } });
      expect(mod.THEME_ACCENT_COLOR).toBe('#00D4FF');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Invalid theme accentColor: "${value}"`));
    },
  );
});

describe('applyTheme', () => {
  it('sets accent, rgb and clamped glow CSS custom properties', async () => {
    const mod = await load({ theme: { accentColor: '#F0D400' } });
    mod.applyTheme();
    const s = document.documentElement.style;
    expect(s.getPropertyValue('--theme-accent')).toBe('#F0D400');
    expect(s.getPropertyValue('--theme-accent-rgb')).toBe('240, 212, 0');
    // +40 per channel, clamped at 255
    expect(s.getPropertyValue('--theme-glow')).toBe('rgb(255, 252, 40)');
    expect(s.getPropertyValue('--theme-glow-rgb')).toBe('255, 252, 40');
  });

  it('expands shorthand before computing properties', async () => {
    const mod = await load({ theme: { accentColor: '#000' } });
    mod.applyTheme();
    const s = document.documentElement.style;
    expect(s.getPropertyValue('--theme-accent')).toBe('#000');
    expect(s.getPropertyValue('--theme-accent-rgb')).toBe('0, 0, 0');
    expect(s.getPropertyValue('--theme-glow-rgb')).toBe('40, 40, 40');
  });
});
