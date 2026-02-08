import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * CSS structural tests for cyberpunk/Fringe-punk enhancements.
 * Follows the pattern established in App.test.js: read styles.css as text
 * and assert structural invariants using regex.
 */

const cssPath = path.resolve(__dirname, '../src/styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

describe('Cyberpunk CSS Custom Properties', () => {
  it('should define neon-pink color variables', () => {
    expect(cssContent).toMatch(/--neon-pink:\s*#FF2E8B/i);
    expect(cssContent).toMatch(/--neon-pink-rgb:\s*255,\s*46,\s*139/);
  });

  it('should define neon-green color variables', () => {
    expect(cssContent).toMatch(/--neon-green:\s*#39FF14/i);
    expect(cssContent).toMatch(/--neon-green-rgb:\s*57,\s*255,\s*20/);
  });

  it('should preserve existing theme accent variables', () => {
    expect(cssContent).toMatch(/--theme-accent:\s*#00D4FF/i);
    expect(cssContent).toMatch(/--theme-accent-rgb:\s*0,\s*212,\s*255/);
  });
});

describe('Background Grid Overlay', () => {
  it('should have a body::before pseudo-element for the grid', () => {
    expect(cssContent).toMatch(/body::before\s*\{/);
  });

  it('grid overlay should not block interaction', () => {
    // Extract the body::before rule
    const match = cssContent.match(/body::before\s*\{([^}]*)\}/s);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/pointer-events:\s*none/);
  });

  it('grid overlay should be fixed position', () => {
    // Match the body::before that contains the grid background (not other body::before rules)
    const match = cssContent.match(/body::before\s*\{[^}]*background-size:\s*60px\s+60px[^}]*\}/s);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/position:\s*fixed/);
  });

  it('should have grid-drift animation', () => {
    expect(cssContent).toMatch(/@keyframes\s+grid-drift/);
  });
});

describe('Card Cyberpunk Effects', () => {
  it('card should have transition for smooth hover effects', () => {
    expect(cssContent).toMatch(/\.card\s*\{[^}]*transition:/s);
  });

  it('card should have CSS containment for performance', () => {
    expect(cssContent).toMatch(/\.card\s*\{[^}]*contain:\s*layout\s+style\s+paint/s);
  });

  it('card should have touch-action: manipulation for mobile', () => {
    expect(cssContent).toMatch(/\.card\s*\{[^}]*touch-action:\s*manipulation/s);
  });

  it('card should have scanline overlay via ::before', () => {
    expect(cssContent).toMatch(/\.card::before\s*\{/);
    const match = cssContent.match(/\.card::before\s*\{([^}]*)\}/s);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/pointer-events:\s*none/);
    expect(match[1]).toMatch(/repeating-linear-gradient/);
  });

  it('card should have scan beam via ::after', () => {
    expect(cssContent).toMatch(/\.card::after\s*\{/);
    const match = cssContent.match(/\.card::after\s*\{([^}]*)\}/s);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/pointer-events:\s*none/);
  });

  it('card hover should use theme accent for border glow', () => {
    expect(cssContent).toMatch(/\.card:hover\s*\{[^}]*border-color:\s*var\(--theme-accent\)/s);
  });

  it('card filename should have z-index above pseudo-elements', () => {
    // Filename should be above scanlines (z:1) and scan beam (z:2)
    expect(cssContent).toMatch(/\.card\s+\.filename\s*\{[^}]*z-index:\s*3/s);
  });

  it('should have card entrance animation', () => {
    expect(cssContent).toMatch(/@keyframes\s+card-entrance/);
    expect(cssContent).toMatch(/\.gallery-grid\s+\.card\s*\{[^}]*animation:\s*card-entrance/s);
  });
});

describe('Campaign Title Effects', () => {
  it('campaign title should have text glow', () => {
    expect(cssContent).toMatch(/\.campaign-info\s+h1\s*\{[^}]*text-shadow:/s);
  });

  it('campaign title should have breathing animation', () => {
    expect(cssContent).toMatch(/@keyframes\s+text-breathe/);
  });

  it('current campaign should have scanner underline', () => {
    expect(cssContent).toMatch(/\.current-campaign::after\s*\{/);
    expect(cssContent).toMatch(/@keyframes\s+scanner-line/);
  });

  it('current campaign should have glitch effect on hover', () => {
    expect(cssContent).toMatch(/\.current-campaign:hover\s*\{[^}]*animation:\s*glitch-text/s);
    expect(cssContent).toMatch(/@keyframes\s+glitch-text/);
  });
});

describe('Toolbar Enhancements', () => {
  it('toolbar should have gradient border', () => {
    expect(cssContent).toMatch(/\.toolbar\s*\{[^}]*border-image:/s);
  });

  it('toolbar button should have radial gradient pseudo-element on hover', () => {
    expect(cssContent).toMatch(/\.toolbar-button::before\s*\{/);
    expect(cssContent).toMatch(/\.toolbar-button:hover::before\s*\{[^}]*opacity:\s*1/s);
  });

  it('toolbar button hover should have neon text-shadow', () => {
    expect(cssContent).toMatch(/\.toolbar-button:hover\s*\{[^}]*text-shadow:/s);
  });
});

describe('Lightbox Enhancements', () => {
  it('lightbox image should have glow pulse animation', () => {
    expect(cssContent).toMatch(/@keyframes\s+holo-frame-pulse/);
    expect(cssContent).toMatch(/\.lightbox\s+img\s*\{[^}]*animation:\s*holo-frame-pulse/s);
  });

  it('lightbox HUD overlay should not block interaction', () => {
    expect(cssContent).toMatch(/\.lightbox-hud\s*\{[^}]*pointer-events:\s*none/s);
  });

  it('lightbox actions should have backdrop blur', () => {
    expect(cssContent).toMatch(/\.lightbox-actions\s*\{[^}]*backdrop-filter:\s*blur/s);
  });

  it('lightbox corner bracket styles should exist', () => {
    expect(cssContent).toMatch(/\.lightbox-brackets/);
    expect(cssContent).toMatch(/\.bracket\.top-left/);
    expect(cssContent).toMatch(/\.bracket\.bottom-right/);
  });
});

describe('Content Modal Enhancements', () => {
  it('content modal header should have classified text', () => {
    expect(cssContent).toMatch(/\.content-modal-header::after\s*\{[^}]*content:\s*'CLASSIFIED/s);
  });
});

describe('CSS Containment for Performance', () => {
  it('gallery-grid should have layout containment', () => {
    expect(cssContent).toMatch(/\.gallery-grid\s*\{[^}]*contain:\s*layout\s+style/s);
  });

  it('lightbox should have strict containment', () => {
    expect(cssContent).toMatch(/\.lightbox\s*\{[^}]*contain:\s*strict/s);
  });

  it('sidebar should have containment', () => {
    expect(cssContent).toMatch(/\.sidebar\s*\{[^}]*contain:\s*layout\s+style\s+paint/s);
  });
});

describe('Settings Panel CSS', () => {
  it('should have settings toggle styles', () => {
    expect(cssContent).toMatch(/\.settings-toggle\s*\{/);
    expect(cssContent).toMatch(/\.settings-toggle\.active/);
    expect(cssContent).toMatch(/\.settings-toggle-knob/);
  });

  it('settings toggle should have accessible sizing', () => {
    const match = cssContent.match(/\.settings-toggle\s*\{([^}]*)\}/s);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/width:\s*48px/);
    expect(match[1]).toMatch(/height:\s*26px/);
  });
});
