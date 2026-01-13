/**
 * Theme Configuration
 *
 * Loads and validates theme settings from config.yaml
 * and provides utilities for applying the theme.
 */

import type { AppConfig } from '../types/appConfig';
import configYaml from '../../config.yaml';

const config = configYaml as AppConfig;

/**
 * Default accent color - Fringe cyan/ice-blue derived from glyph images
 */
const DEFAULT_ACCENT_COLOR = '#00D4FF';

/**
 * Validates a CSS hex color string.
 * Returns the color if valid, or the default if invalid.
 *
 * Accepts 3-character (#RGB) or 6-character (#RRGGBB) hex formats.
 * Alpha channel formats (4 or 8 character) are not supported; use
 * standard RGB hex values instead.
 *
 * @param value - The hex color string to validate (with or without # prefix)
 * @returns The validated hex color with # prefix, or the default color if invalid
 */
function validateHexColor(value: string | undefined): string {
  if (!value) {
    return DEFAULT_ACCENT_COLOR;
  }

  // Match 3 or 6 character hex colors (with or without #)
  // Alpha formats (4 or 8 char) are not supported
  const hexPattern = /^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

  if (!hexPattern.test(value)) {
    console.warn(
      `Invalid theme accentColor: "${value}". ` +
      `Must be a valid CSS hex color (e.g., "#00D4FF"). ` +
      `Using default "${DEFAULT_ACCENT_COLOR}".`
    );
    return DEFAULT_ACCENT_COLOR;
  }

  // Ensure the color has a # prefix
  return value.startsWith('#') ? value : `#${value}`;
}

/**
 * The configured accent color from config.yaml or default.
 */
export const THEME_ACCENT_COLOR: string = validateHexColor(config.theme?.accentColor);

/**
 * Converts a hex color string to RGB component values.
 *
 * Supports 3-character (#RGB) and 6-character (#RRGGBB) formats.
 * The # prefix is optional.
 *
 * @param hex - The hex color string to convert
 * @returns Object containing r, g, b values (0-255 each)
 *
 * @example
 * hexToRgb('#00D4FF') // { r: 0, g: 212, b: 255 }
 * hexToRgb('F00')     // { r: 255, g: 0, b: 0 }
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Expand 3-character shorthand to 6-character format
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;

  const num = parseInt(fullHex.substring(0, 6), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Applies the theme accent color as CSS custom properties on the document root.
 *
 * Sets the following CSS custom properties:
 * - `--theme-accent`: The accent color as a hex value
 * - `--theme-accent-rgb`: RGB components as "r, g, b" for use in rgba()
 * - `--theme-glow`: A brighter variant for glow effects
 * - `--theme-glow-rgb`: RGB components of the glow color
 *
 * Call this once when the app initializes.
 */
export function applyTheme(): void {
  const root = document.documentElement;
  const rgb = hexToRgb(THEME_ACCENT_COLOR);

  // Main accent color
  root.style.setProperty('--theme-accent', THEME_ACCENT_COLOR);

  // RGB components as comma-separated string for use in rgba()
  root.style.setProperty('--theme-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

  // Glow color (slightly brighter/lighter version)
  const glowR = Math.min(255, rgb.r + 40);
  const glowG = Math.min(255, rgb.g + 40);
  const glowB = Math.min(255, rgb.b + 40);
  root.style.setProperty('--theme-glow', `rgb(${glowR}, ${glowG}, ${glowB})`);
  root.style.setProperty('--theme-glow-rgb', `${glowR}, ${glowG}, ${glowB}`);
}
