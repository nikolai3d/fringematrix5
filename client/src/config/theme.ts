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
 */
function validateHexColor(value: string | undefined): string {
  if (!value) {
    return DEFAULT_ACCENT_COLOR;
  }

  // Match 3, 4, 6, or 8 character hex colors (with or without #)
  const hexPattern = /^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;

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
 * Converts a hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Handle 3-character hex
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
 * Call this once when the app initializes.
 */
export function applyTheme(): void {
  const root = document.documentElement;
  const rgb = hexToRgb(THEME_ACCENT_COLOR);

  // Main accent color
  root.style.setProperty('--theme-accent', THEME_ACCENT_COLOR);

  // RGB components for creating rgba() values
  root.style.setProperty('--theme-accent-r', String(rgb.r));
  root.style.setProperty('--theme-accent-g', String(rgb.g));
  root.style.setProperty('--theme-accent-b', String(rgb.b));

  // Pre-computed variations for common use cases
  root.style.setProperty('--theme-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

  // Glow color (slightly brighter/lighter version)
  const glowR = Math.min(255, rgb.r + 40);
  const glowG = Math.min(255, rgb.g + 40);
  const glowB = Math.min(255, rgb.b + 40);
  root.style.setProperty('--theme-glow', `rgb(${glowR}, ${glowG}, ${glowB})`);
  root.style.setProperty('--theme-glow-rgb', `${glowR}, ${glowG}, ${glowB}`);
}
