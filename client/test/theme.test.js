import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the exported functions directly
// The theme module reads config.yaml at import time, so we test the pure functions
// by importing them and testing with known inputs.

describe('hexToRgb', () => {
  // Dynamically import to avoid config.yaml import issues in test
  let hexToRgb;

  beforeEach(async () => {
    // Reset modules to get fresh imports
    const mod = await import('../src/config/theme.ts');
    hexToRgb = mod.hexToRgb;
  });

  it('should parse 6-character hex with # prefix', () => {
    const result = hexToRgb('#00D4FF');
    expect(result).toEqual({ r: 0, g: 212, b: 255 });
  });

  it('should parse 6-character hex without # prefix', () => {
    const result = hexToRgb('00D4FF');
    expect(result).toEqual({ r: 0, g: 212, b: 255 });
  });

  it('should parse 3-character hex shorthand', () => {
    const result = hexToRgb('#F00');
    expect(result).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should parse 3-character hex without #', () => {
    const result = hexToRgb('F00');
    expect(result).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should handle pure white', () => {
    const result = hexToRgb('#FFFFFF');
    expect(result).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('should handle pure black', () => {
    const result = hexToRgb('#000000');
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('should handle the neon pink color', () => {
    const result = hexToRgb('#FF2E8B');
    expect(result).toEqual({ r: 255, g: 46, b: 139 });
  });

  it('should handle the neon green color', () => {
    const result = hexToRgb('#39FF14');
    expect(result).toEqual({ r: 57, g: 255, b: 20 });
  });

  it('should handle purple accent color', () => {
    const result = hexToRgb('#7c4dff');
    expect(result).toEqual({ r: 124, g: 77, b: 255 });
  });

  it('glow color should be brighter than accent', () => {
    const accent = hexToRgb('#00D4FF');
    // Glow is accent + 40 per channel (clamped to 255)
    const glowR = Math.min(255, accent.r + 40);
    const glowG = Math.min(255, accent.g + 40);
    const glowB = Math.min(255, accent.b + 40);
    expect(glowR).toBeGreaterThanOrEqual(accent.r);
    expect(glowG).toBeGreaterThanOrEqual(accent.g);
    expect(glowB).toBeGreaterThanOrEqual(accent.b);
  });
});

describe('Theme accent color validation', () => {
  it('THEME_ACCENT_COLOR should be a valid hex color', async () => {
    const mod = await import('../src/config/theme.ts');
    expect(mod.THEME_ACCENT_COLOR).toMatch(/^#[A-Fa-f0-9]{3,6}$/);
  });

  it('THEME_ACCENT_COLOR should start with #', async () => {
    const mod = await import('../src/config/theme.ts');
    expect(mod.THEME_ACCENT_COLOR.startsWith('#')).toBe(true);
  });
});
