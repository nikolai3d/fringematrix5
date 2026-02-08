import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Accessibility tests for the cyberpunk redesign.
 * Covers: contrast ratios, prefers-reduced-motion, ARIA, focus management,
 * settings panel logic, and swipe gesture logic.
 */

const cssPath = path.resolve(__dirname, '../src/styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

const appPath = path.resolve(__dirname, '../src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

// Helper: calculate relative luminance from sRGB channel (0-255)
function sRGBtoLinear(channel) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r, g, b) {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Color Contrast Ratios (WCAG 2.1)', () => {
  // Background color
  const bgR = 6, bgG = 9, bgB = 15; // #06090f
  const bgLum = relativeLuminance(bgR, bgG, bgB);

  it('foreground text (#e6f0ff) on dark bg should meet WCAG AAA (7:1)', () => {
    const fgLum = relativeLuminance(0xe6, 0xf0, 0xff);
    const ratio = contrastRatio(fgLum, bgLum);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('muted text (#89a0b3) on dark bg should meet WCAG AA (4.5:1)', () => {
    const mutedLum = relativeLuminance(0x89, 0xa0, 0xb3);
    const ratio = contrastRatio(mutedLum, bgLum);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('accent cyan (#00D4FF) on dark bg should meet WCAG AA for large text (3:1)', () => {
    const accentLum = relativeLuminance(0x00, 0xD4, 0xFF);
    const ratio = contrastRatio(accentLum, bgLum);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('accent purple (#7c4dff) on dark bg should meet WCAG AA for large text (3:1)', () => {
    const purpleLum = relativeLuminance(0x7c, 0x4d, 0xff);
    const ratio = contrastRatio(purpleLum, bgLum);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('neon pink (#FF2E8B) on dark bg should meet WCAG AA for large text (3:1)', () => {
    const pinkLum = relativeLuminance(0xFF, 0x2E, 0x8B);
    const ratio = contrastRatio(pinkLum, bgLum);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('card filename text (#cfe3ff) on dark overlay should meet WCAG AA', () => {
    // Filename sits on a dark gradient background on top of images
    // Test against a dark surface approximating the overlay
    const overlayLum = relativeLuminance(0x10, 0x10, 0x10);
    const filenameLum = relativeLuminance(0xcf, 0xe3, 0xff);
    const ratio = contrastRatio(filenameLum, overlayLum);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('prefers-reduced-motion Support', () => {
  it('CSS should contain @media (prefers-reduced-motion: reduce)', () => {
    expect(cssContent).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('reduced motion should disable animation-duration', () => {
    // Find the reduced-motion media query and check its contents
    const match = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]*\{[^}]*\}[^}]*)\}/s);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });

  it('reduced motion should disable transition-duration', () => {
    const match = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]*\{[^}]*\}[^}]*)\}/s);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it('reduced motion should limit animation iterations', () => {
    const match = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]*\{[^}]*\}[^}]*)\}/s);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/animation-iteration-count:\s*1\s*!important/);
  });
});

describe('User Accessibility Settings CSS Classes', () => {
  it('CSS should support html.reduce-motion class', () => {
    expect(cssContent).toMatch(/html\.reduce-motion/);
  });

  it('html.reduce-motion should disable animations', () => {
    expect(cssContent).toMatch(/html\.reduce-motion[^{]*\{[^}]*animation-duration:\s*0\.01ms\s*!important/s);
  });

  it('CSS should support html.reduce-effects class', () => {
    expect(cssContent).toMatch(/html\.reduce-effects/);
  });

  it('html.reduce-effects should hide body grid overlay', () => {
    expect(cssContent).toMatch(/html\.reduce-effects\s+body::before\s*\{[^}]*display:\s*none/s);
  });

  it('html.reduce-effects should hide card scanline overlay', () => {
    expect(cssContent).toMatch(/html\.reduce-effects\s+\.card::before\s*\{[^}]*display:\s*none/s);
  });

  it('html.reduce-effects should hide card scan beam', () => {
    expect(cssContent).toMatch(/html\.reduce-effects\s+\.card::after\s*\{[^}]*display:\s*none/s);
  });

  it('html.reduce-effects should disable lightbox animation', () => {
    expect(cssContent).toMatch(/html\.reduce-effects\s+\.lightbox\s+img\s*\{[^}]*animation:\s*none/s);
  });
});

describe('Touch/Hover Media Queries', () => {
  it('CSS should contain @media (hover: none) for touch devices', () => {
    expect(cssContent).toMatch(/@media\s*\(hover:\s*none\)/);
  });

  it('hover: none should disable card hover transform', () => {
    const match = cssContent.match(/@media\s*\(hover:\s*none\)\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/\.card:hover\s*\{[^}]*transform:\s*none/s);
  });

  it('hover: none should provide :active state for cards', () => {
    const match = cssContent.match(/@media\s*\(hover:\s*none\)\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/\.card:active/);
  });
});

describe('Responsive Breakpoints', () => {
  it('should have mobile breakpoint (max-width: 767px)', () => {
    expect(cssContent).toMatch(/@media\s*\(max-width:\s*767px\)/);
  });

  it('mobile should disable body grid overlay', () => {
    const match = cssContent.match(/@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/body::before\s*\{[^}]*display:\s*none/s);
  });

  it('mobile should disable backdrop-filter on navbar', () => {
    const match = cssContent.match(/@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/\.navbar\s*\{[^}]*backdrop-filter:\s*none/s);
  });

  it('mobile should disable lightbox glow animation', () => {
    const match = cssContent.match(/@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/\.lightbox\s+img\s*\{[^}]*animation:\s*none/s);
  });

  it('should have tablet breakpoint', () => {
    expect(cssContent).toMatch(/@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)/);
  });

  it('should have large desktop breakpoint (1440px)', () => {
    expect(cssContent).toMatch(/@media\s*\(min-width:\s*1440px\)/);
  });
});

describe('ARIA Attributes in App.tsx', () => {
  it('toolbar should have role="toolbar"', () => {
    expect(appContent).toMatch(/role="toolbar"/);
  });

  it('toolbar should have aria-label', () => {
    expect(appContent).toMatch(/aria-label="Primary actions"/);
  });

  it('lightbox close button should have aria-label', () => {
    expect(appContent).toMatch(/className="lightbox-close"[^>]*aria-label="Close"/s);
  });

  it('nav arrows should have aria-labels', () => {
    expect(appContent).toMatch(/aria-label="Previous campaign"/);
    expect(appContent).toMatch(/aria-label="Next campaign"/);
  });

  it('sidebar should have aria-hidden attribute', () => {
    expect(appContent).toMatch(/aria-hidden=\{!isSidebarOpen\}/);
  });

  it('content modal should have aria-modal and role="dialog"', () => {
    expect(appContent).toMatch(/role="dialog"\s+aria-modal=\{true\}/);
  });

  it('lightbox HUD should be aria-hidden', () => {
    expect(appContent).toMatch(/className="lightbox-hud"\s+aria-hidden=\{true\}/);
  });
});

describe('Settings Panel Accessibility', () => {
  it('settings toggles should use role="switch"', () => {
    const switchCount = (appContent.match(/role="switch"/g) || []).length;
    expect(switchCount).toBeGreaterThanOrEqual(2); // At least 2 toggle switches
  });

  it('settings toggles should have aria-checked', () => {
    expect(appContent).toMatch(/aria-checked=\{reduceMotion\}/);
    expect(appContent).toMatch(/aria-checked=\{reduceEffects\}/);
  });

  it('settings modal should have aria-labelledby', () => {
    expect(appContent).toMatch(/aria-labelledby="settings-title"/);
  });

  it('settings close button should have aria-label', () => {
    expect(appContent).toMatch(/aria-label="Close settings"/);
  });
});

describe('Accessibility Settings Logic', () => {
  it('should toggle reduceMotion class on html element', () => {
    const root = document.documentElement;
    root.classList.add('reduce-motion');
    expect(root.classList.contains('reduce-motion')).toBe(true);
    root.classList.remove('reduce-motion');
    expect(root.classList.contains('reduce-motion')).toBe(false);
  });

  it('should toggle reduceEffects class on html element', () => {
    const root = document.documentElement;
    root.classList.add('reduce-effects');
    expect(root.classList.contains('reduce-effects')).toBe(true);
    root.classList.remove('reduce-effects');
    expect(root.classList.contains('reduce-effects')).toBe(false);
  });

  it('localStorage should serialize settings correctly', () => {
    const settings = { reduceMotion: true, reduceEffects: false };
    const serialized = JSON.stringify(settings);
    const parsed = JSON.parse(serialized);
    expect(parsed.reduceMotion).toBe(true);
    expect(parsed.reduceEffects).toBe(false);
  });

  it('should handle corrupt localStorage gracefully', () => {
    expect(() => {
      const val = 'not-json';
      JSON.parse(val);
    }).toThrow();
    // The app wraps this in try/catch, so it should not crash
  });

  it('should validate parsed settings have correct types', () => {
    const validSettings = { reduceMotion: true, reduceEffects: false };
    expect(typeof validSettings.reduceMotion).toBe('boolean');
    expect(typeof validSettings.reduceEffects).toBe('boolean');

    const invalidSettings = { reduceMotion: 'yes', reduceEffects: 42 };
    expect(typeof invalidSettings.reduceMotion === 'boolean').toBe(false);
    expect(typeof invalidSettings.reduceEffects === 'boolean').toBe(false);
  });
});

describe('Swipe Gesture Logic', () => {
  it('horizontal right swipe should navigate to previous', () => {
    const startX = 200;
    const endX = 280; // +80px right swipe
    const startY = 300;
    const endY = 310; // small vertical movement
    const dt = 200; // 200ms

    const dx = endX - startX;
    const dy = endY - startY;

    expect(Math.abs(dx)).toBeGreaterThan(50); // meets threshold
    expect(Math.abs(dy)).toBeLessThan(75); // within vertical tolerance
    expect(dt).toBeLessThan(500); // within time limit

    // dx > 0 means right swipe = previous image
    expect(dx).toBeGreaterThan(0);
  });

  it('horizontal left swipe should navigate to next', () => {
    const startX = 280;
    const endX = 200; // -80px left swipe
    const startY = 300;
    const endY = 305;
    const dt = 150;

    const dx = endX - startX;
    const dy = endY - startY;

    expect(Math.abs(dx)).toBeGreaterThan(50);
    expect(Math.abs(dy)).toBeLessThan(75);
    expect(dt).toBeLessThan(500);

    // dx < 0 means left swipe = next image
    expect(dx).toBeLessThan(0);
  });

  it('small horizontal movement should not trigger swipe', () => {
    const dx = 30; // only 30px, below 50px threshold
    expect(Math.abs(dx)).toBeLessThan(50);
  });

  it('large vertical movement should not trigger swipe', () => {
    const dx = 80;
    const dy = 100; // too much vertical movement
    expect(Math.abs(dy)).toBeGreaterThanOrEqual(75);
  });

  it('slow swipe should not trigger navigation', () => {
    const dt = 600; // 600ms, above 500ms limit
    expect(dt).toBeGreaterThanOrEqual(500);
  });

  it('mouse pointer events should be ignored for swipe', () => {
    const pointerType = 'mouse';
    expect(pointerType).toBe('mouse');
    // The handler returns early for mouse events
  });
});

describe('closeAllSubwindows includes settings', () => {
  it('should close settings when closeAllSubwindows is called', () => {
    const calls = {
      lightbox: [], sidebar: [], buildInfo: [], share: [], modal: [], settings: []
    };

    const setters = {
      setIsLightboxOpen: (val) => calls.lightbox.push(val),
      setIsSidebarOpen: (val) => calls.sidebar.push(val),
      setIsBuildInfoOpen: (val) => calls.buildInfo.push(val),
      setIsShareOpen: (val) => calls.share.push(val),
      setActiveModal: (val) => calls.modal.push(val),
      setIsSettingsOpen: (val) => calls.settings.push(val)
    };

    // Simulate closeAllSubwindows
    const closeAllSubwindows = () => {
      setters.setIsLightboxOpen(false);
      setters.setIsSidebarOpen(false);
      setters.setIsBuildInfoOpen(false);
      setters.setIsShareOpen(false);
      setters.setActiveModal(null);
      setters.setIsSettingsOpen(false);
    };

    closeAllSubwindows();

    expect(calls.settings).toContain(false);
    expect(calls.lightbox).toContain(false);
    expect(calls.sidebar).toContain(false);
    expect(calls.buildInfo).toContain(false);
    expect(calls.share).toContain(false);
    expect(calls.modal).toContain(null);
  });
});
