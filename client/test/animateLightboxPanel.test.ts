/**
 * Unit tests for the `animateLightboxPanel` exported function and the three
 * panel-animation wrappers (sidebar, nav toolbar, image frame) that live
 * inside useLightboxAnimations.
 *
 * Coverage:
 *  - Reduce-motion early-return: options.reduceMotion flag
 *  - Reduce-motion early-return: html.reduce-motion / html.reduce-effects classes
 *  - Reduce-motion early-return: prefers-reduced-motion media query
 *  - Null-element guard: resolves without throwing
 *  - Config values read from LIGHTBOX_PANEL_ANIMATION
 *  - COLLAPSED_CLIP inline style applied at phase 0 (direction='in')
 *  - element.animate is called when all guards are clear
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { animateLightboxPanel } from '../src/hooks/useLightboxAnimations';
import { LIGHTBOX_PANEL_ANIMATION } from '../src/config/lightbox';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a minimal HTMLElement with a spy on .animate() */
function makeEl(): HTMLElement {
  const el = document.createElement('div');
  // jsdom does not implement Web Animations API — install a stub that
  // returns an Animation-like object the function can await on.
  Object.defineProperty(el, 'animate', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      finished: Promise.resolve(),
      cancel: () => {},
      currentTime: 0,
    })),
  });
  return el;
}

/** Minimal cfg for reduce-motion tests where we bail before reading cfg. */
const DUMMY_CFG = LIGHTBOX_PANEL_ANIMATION;

// ─────────────────────────────────────────────────────────────────────────────
// Reduce-motion guards
// ─────────────────────────────────────────────────────────────────────────────

describe('animateLightboxPanel — reduce-motion early returns', () => {
  afterEach(() => {
    // Clean up any classes added to <html>
    document.documentElement.classList.remove('reduce-motion', 'reduce-effects');
  });

  it('resolves immediately when options.reduceMotion is true', async () => {
    const el = makeEl();
    await animateLightboxPanel(el, 'in', DUMMY_CFG, { reduceMotion: true });
    // animate must NOT have been called — we bailed out before touching the element
    expect((el.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('resolves immediately when html has class reduce-motion', async () => {
    document.documentElement.classList.add('reduce-motion');
    const el = makeEl();
    await animateLightboxPanel(el, 'in', DUMMY_CFG);
    expect((el.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('resolves immediately when html has class reduce-effects', async () => {
    document.documentElement.classList.add('reduce-effects');
    const el = makeEl();
    await animateLightboxPanel(el, 'in', DUMMY_CFG);
    expect((el.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('resolves immediately when prefers-reduced-motion media query matches', async () => {
    // Override window.matchMedia to return matches:true for the relevant query.
    // Restore via afterEach so cleanup runs even if the test body throws.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') {
        return { matches: true, media: query, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false, onchange: null } as MediaQueryList;
      }
      return originalMatchMedia(query);
    };
    try {
      const el = makeEl();
      await animateLightboxPanel(el, 'in', DUMMY_CFG);
      expect((el.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('resolves immediately with direction=out when options.reduceMotion is true', async () => {
    const el = makeEl();
    await animateLightboxPanel(el, 'out', DUMMY_CFG, { reduceMotion: true });
    expect((el.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Null-element guard
// ─────────────────────────────────────────────────────────────────────────────

describe('animateLightboxPanel — null element guard', () => {
  it('resolves without throwing when element is null (direction=in)', async () => {
    await expect(
      animateLightboxPanel(null, 'in', DUMMY_CFG, { reduceMotion: false })
    ).resolves.toBeUndefined();
  });

  it('resolves without throwing when element is null (direction=out)', async () => {
    await expect(
      animateLightboxPanel(null, 'out', DUMMY_CFG, { reduceMotion: false })
    ).resolves.toBeUndefined();
  });

  it('resolves without throwing when element is null and reduce-motion class is absent', async () => {
    // Ensure guards pass so we reach the null-element check
    document.documentElement.classList.remove('reduce-motion', 'reduce-effects');
    await expect(
      animateLightboxPanel(null, 'in', DUMMY_CFG)
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Config values read from LIGHTBOX_PANEL_ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

describe('animateLightboxPanel — reads resolved config', () => {
  it('LIGHTBOX_PANEL_ANIMATION exposes all required timing fields', () => {
    const cfg = LIGHTBOX_PANEL_ANIMATION;
    const fields = [
      'enterDurationMs',
      'exitDurationMs',
      'lineHoldMs',
      'lineBlinkCount',
      'lineBlinkIntervalMs',
      'contentFadeInDelayMs',
    ] as const;
    for (const field of fields) {
      expect(typeof cfg[field]).toBe('number');
      expect(Number.isFinite(cfg[field])).toBe(true);
    }
  });

  it('passes enterDurationMs from cfg to the expand animation', async () => {
    const el = makeEl();
    const child = document.createElement('span');
    el.appendChild(child);
    // child also needs animate stub
    Object.defineProperty(child, 'animate', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ finished: Promise.resolve(), cancel: () => {}, currentTime: 0 })),
    });

    const fastCfg = { ...DUMMY_CFG, enterDurationMs: 100, lineHoldMs: 0, lineBlinkCount: 0 };
    await animateLightboxPanel(el, 'in', fastCfg, { reduceMotion: false });

    // el.animate should have been called (for the expand phase at minimum)
    const animateSpy = el.animate as ReturnType<typeof vi.fn>;
    expect(animateSpy).toHaveBeenCalled();
    // The expand call uses duration = enterDurationMs - lineHoldMs = 100 - 0 = 100
    const lastCall = animateSpy.mock.calls[animateSpy.mock.calls.length - 1];
    const options = lastCall[1] as KeyframeAnimationOptions;
    expect(options.duration).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 0: COLLAPSED_CLIP applied as inline style
// ─────────────────────────────────────────────────────────────────────────────

describe('animateLightboxPanel — phase 0 collapsed clip style', () => {
  it('sets clipPath to COLLAPSED_CLIP inline at phase 0 on direction=in', async () => {
    const el = makeEl();
    const COLLAPSED_CLIP = 'inset(calc(50% - 1px) 0 calc(50% - 1px) 0)';

    let capturedClipPath: string | null = null;
    const originalAnimate = el.animate;
    // Intercept the FIRST animate call (blink or expand) to capture the style
    // that was applied synchronously BEFORE any animate was called.
    (el as unknown as { animate: typeof el.animate }).animate = vi.fn(function (
      this: HTMLElement,
      ...args: Parameters<typeof el.animate>
    ) {
      if (capturedClipPath === null) {
        capturedClipPath = this.style.clipPath;
      }
      return originalAnimate.call(this, ...args);
    }) as unknown as typeof el.animate;

    const cfg = { ...DUMMY_CFG, lineBlinkCount: 0, lineHoldMs: 0, enterDurationMs: 50 };
    await animateLightboxPanel(el, 'in', cfg, { reduceMotion: false });

    expect(capturedClipPath).toBe(COLLAPSED_CLIP);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Direction=out path calls animate
// ─────────────────────────────────────────────────────────────────────────────

describe('animateLightboxPanel — direction=out', () => {
  it('calls el.animate for the collapse phases', async () => {
    const el = makeEl();
    await animateLightboxPanel(el, 'out', DUMMY_CFG, { reduceMotion: false });
    const animateSpy = el.animate as ReturnType<typeof vi.fn>;
    expect(animateSpy).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Source-level: three wrapper functions exist and call animateLightboxPanel
// ─────────────────────────────────────────────────────────────────────────────

const hookSrc = fs.readFileSync(
  path.resolve(__dirname, '../src/hooks/useLightboxAnimations.ts'),
  'utf-8',
);

describe('useLightboxAnimations — panel animation wrappers (source-level)', () => {
  it('animateLightboxSidebar wrapper queries .lightbox-details', () => {
    expect(hookSrc).toMatch(/\.lightbox-details/);
    expect(hookSrc).toMatch(/animateLightboxSidebar/);
  });

  it('animateLightboxNavToolbar wrapper queries .lightbox-nav-toolbar', () => {
    expect(hookSrc).toMatch(/\.lightbox-nav-toolbar/);
    expect(hookSrc).toMatch(/animateLightboxNavToolbar/);
  });

  it('animateLightboxImageFrame wrapper queries .lightbox-image-wrap', () => {
    expect(hookSrc).toMatch(/\.lightbox-image-wrap/);
    expect(hookSrc).toMatch(/animateLightboxImageFrame/);
  });

  it('all three wrappers delegate to animateLightboxPanel with LIGHTBOX_PANEL_ANIMATION', () => {
    // Each wrapper must call animateLightboxPanel — count the call sites inside wrappers
    const sidebarBlock = hookSrc.match(/const animateLightboxSidebar[\s\S]*?}, \[reduceMotion\]\)/);
    expect(sidebarBlock).not.toBeNull();
    expect(sidebarBlock![0]).toMatch(/animateLightboxPanel/);
    expect(sidebarBlock![0]).toMatch(/LIGHTBOX_PANEL_ANIMATION/);

    const toolbarBlock = hookSrc.match(/const animateLightboxNavToolbar[\s\S]*?}, \[reduceMotion\]\)/);
    expect(toolbarBlock).not.toBeNull();
    expect(toolbarBlock![0]).toMatch(/animateLightboxPanel/);
    expect(toolbarBlock![0]).toMatch(/LIGHTBOX_PANEL_ANIMATION/);

    const frameBlock = hookSrc.match(/const animateLightboxImageFrame[\s\S]*?}, \[reduceMotion\]\)/);
    expect(frameBlock).not.toBeNull();
    expect(frameBlock![0]).toMatch(/animateLightboxPanel/);
    expect(frameBlock![0]).toMatch(/LIGHTBOX_PANEL_ANIMATION/);
  });

  it('animateLightboxImageFrame adds a delay for direction=in (wireframe-tail sync)', () => {
    const frameBlock = hookSrc.match(/const animateLightboxImageFrame[\s\S]*?}, \[reduceMotion\]\)/);
    expect(frameBlock).not.toBeNull();
    // The frame delay is derived from LIGHTBOX_ANIM_MS * 0.35
    expect(frameBlock![0]).toMatch(/frameDelay/);
    expect(frameBlock![0]).toMatch(/LIGHTBOX_ANIM_MS.*0\.35|0\.35.*LIGHTBOX_ANIM_MS/);
  });

  it('animateLightboxImageFrame accepts and checks an AbortSignal', () => {
    const frameBlock = hookSrc.match(/const animateLightboxImageFrame[\s\S]*?}, \[reduceMotion\]\)/);
    expect(frameBlock).not.toBeNull();
    expect(frameBlock![0]).toMatch(/signal\?\.aborted/);
  });

  it('animateLightboxPanel is exported from the module', () => {
    expect(hookSrc).toMatch(/export\s+async\s+function\s+animateLightboxPanel/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CSS reduce-motion guards for all three panels
// ─────────────────────────────────────────────────────────────────────────────

const cssContent = fs.readFileSync(
  path.resolve(__dirname, '../src/styles.css'),
  'utf-8',
);

describe('CSS reduce-motion guards for all three panels', () => {
  it('html.reduce-motion resets clip-path on .lightbox-details', () => {
    expect(cssContent).toMatch(/html\.reduce-motion[\s\S]*?\.lightbox-details[\s\S]*?clip-path/);
  });

  it('html.reduce-effects resets clip-path on .lightbox-details', () => {
    expect(cssContent).toMatch(/html\.reduce-effects[\s\S]*?\.lightbox-details[\s\S]*?clip-path/);
  });

  it('html.reduce-motion resets clip-path on .lightbox-nav-toolbar', () => {
    expect(cssContent).toMatch(/html\.reduce-motion[\s\S]*?\.lightbox-nav-toolbar[\s\S]*?clip-path/);
  });

  it('html.reduce-effects resets clip-path on .lightbox-nav-toolbar', () => {
    expect(cssContent).toMatch(/html\.reduce-effects[\s\S]*?\.lightbox-nav-toolbar[\s\S]*?clip-path/);
  });

  it('html.reduce-motion resets clip-path on .lightbox-image-wrap', () => {
    expect(cssContent).toMatch(/html\.reduce-motion[\s\S]*?\.lightbox-image-wrap[\s\S]*?clip-path/);
  });

  it('html.reduce-effects resets clip-path on .lightbox-image-wrap', () => {
    expect(cssContent).toMatch(/html\.reduce-effects[\s\S]*?\.lightbox-image-wrap[\s\S]*?clip-path/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// skipContentFade option
// ─────────────────────────────────────────────────────────────────────────────

/** Create an el with one child, both having animate stubs. */
function makeElWithChild(): { el: HTMLElement; child: HTMLElement } {
  const el = makeEl();
  const child = document.createElement('span');
  Object.defineProperty(child, 'animate', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ finished: Promise.resolve(), cancel: () => {}, currentTime: 0 })),
  });
  el.appendChild(child);
  return { el, child };
}

describe('animateLightboxPanel — skipContentFade option', () => {
  const FAST_CFG = { ...LIGHTBOX_PANEL_ANIMATION, enterDurationMs: 50, exitDurationMs: 50, lineHoldMs: 0, lineBlinkCount: 0 };

  it('direction=in: child opacity is NOT set to "0" at phase 0 when skipContentFade is true', async () => {
    const { el, child } = makeElWithChild();
    await animateLightboxPanel(el, 'in', FAST_CFG, { reduceMotion: false, skipContentFade: true });
    // Phase 0 must NOT have written opacity:'0' on the child
    expect(child.style.opacity).not.toBe('0');
  });

  it('direction=in: child.animate is NOT called for content fade when skipContentFade is true', async () => {
    const { el, child } = makeElWithChild();
    await animateLightboxPanel(el, 'in', FAST_CFG, { reduceMotion: false, skipContentFade: true });
    expect((child.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('direction=in: child inline opacity NOT cleared in settle when skipContentFade is true', async () => {
    const { el, child } = makeElWithChild();
    // Give child a pre-existing inline opacity to confirm settle leaves it alone
    child.style.opacity = '0.5';
    await animateLightboxPanel(el, 'in', FAST_CFG, { reduceMotion: false, skipContentFade: true });
    // The settle block must not have set child.style.opacity = '' (which would erase '0.5')
    expect(child.style.opacity).toBe('0.5');
  });

  it('direction=out: child.animate is NOT called for fade-out when skipContentFade is true', async () => {
    const { el, child } = makeElWithChild();
    await animateLightboxPanel(el, 'out', FAST_CFG, { reduceMotion: false, skipContentFade: true });
    expect((child.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('direction=in: child opacity IS set to "0" at phase 0 when skipContentFade is false (default)', async () => {
    const { el, child } = makeElWithChild();
    let capturedChildOpacity: string | null = null;
    const origAnimate = (el.animate as ReturnType<typeof vi.fn>);
    (el as unknown as { animate: typeof el.animate }).animate = vi.fn(function (this: HTMLElement, ...args: Parameters<typeof el.animate>) {
      if (capturedChildOpacity === null) capturedChildOpacity = child.style.opacity;
      return origAnimate.call(this, ...args);
    }) as unknown as typeof el.animate;
    await animateLightboxPanel(el, 'in', FAST_CFG, { reduceMotion: false, skipContentFade: false });
    expect(capturedChildOpacity).toBe('0');
  });

  it('direction=out: child.animate IS called for fade-out when skipContentFade is false (default)', async () => {
    const { el, child } = makeElWithChild();
    await animateLightboxPanel(el, 'out', FAST_CFG, { reduceMotion: false, skipContentFade: false });
    expect((child.animate as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('animateLightboxImageFrame passes skipContentFade:true to animateLightboxPanel (source-level)', () => {
    const frameBlock = hookSrc.match(/const animateLightboxImageFrame[\s\S]*?}, \[reduceMotion\]\)/);
    expect(frameBlock).not.toBeNull();
    expect(frameBlock![0]).toMatch(/skipContentFade:\s*true/);
  });
});
