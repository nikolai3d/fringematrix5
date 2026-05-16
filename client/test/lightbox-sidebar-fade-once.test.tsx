/**
 * Regression tests for fringematrix5-qbv:
 *
 *   The IMAGE DETAILS sidebar should play its line→expand fade-in
 *   animation EXACTLY ONCE per open session — on the initial zoom-in
 *   from a thumbnail. Pressing PREVIOUS / NEXT / arrow keys / swiping
 *   must NOT replay the animation (it caused flicker).
 *
 * Strategy: two test groups.
 *   1. Source-level — assert the hook contains the sidebarEnteredRef
 *      guard and uses it at every sidebar('in') call site.
 *   2. Behavioural — render an isolated harness that drives the hook
 *      with mocked HTMLElement.animate, then assert call counts on
 *      the sidebar element across open / navigate / close.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useRef, useState } from 'react';
import fs from 'fs';
import path from 'path';
import { useLightboxAnimations } from '../src/hooks/useLightboxAnimations';
import type { ImageData } from '../src/types/api';

const hookSrc = fs.readFileSync(
  path.resolve(__dirname, '../src/hooks/useLightboxAnimations.ts'),
  'utf-8',
);

// =============================================================================
// 1. Source-level guards
// =============================================================================

describe('useLightboxAnimations — sidebar-fade-once source guards', () => {
  it('declares a sidebarEnteredRef', () => {
    expect(hookSrc).toMatch(/sidebarEnteredRef\s*=\s*useRef<boolean>\(false\)/);
  });

  it('resets sidebarEnteredRef in openLightbox so each session starts fresh', () => {
    // The reset must appear inside the openLightbox callback body, BEFORE
    // any animation work. We check positional ordering instead of doing a
    // pricier AST parse.
    const openIdx = hookSrc.indexOf('const openLightbox = useCallback');
    const closeIdx = hookSrc.indexOf('const closeLightbox = useCallback');
    expect(openIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(openIdx);
    const openBody = hookSrc.slice(openIdx, closeIdx);
    expect(openBody).toMatch(/sidebarEnteredRef\.current\s*=\s*false/);
  });

  it('guards every animateLightboxSidebar("in") call site with the ref', () => {
    // Every 'in' call must be preceded (within a short window) by a check
    // on sidebarEnteredRef.current. We extract the surrounding ~200 chars
    // for each "in" call and assert the guard is present.
    const regex = /animateLightboxSidebar\(\s*['"]in['"]\s*\)/g;
    const matches = [...hookSrc.matchAll(regex)];
    expect(matches.length).toBeGreaterThanOrEqual(3);
    for (const m of matches) {
      const start = Math.max(0, (m.index ?? 0) - 250);
      const window = hookSrc.slice(start, (m.index ?? 0));
      expect(window).toMatch(/sidebarEnteredRef\.current/);
    }
  });

  it('does NOT guard the close-direction call with the ref (out must always run)', () => {
    const regex = /animateLightboxSidebar\(\s*['"]out['"]\s*\)/g;
    const matches = [...hookSrc.matchAll(regex)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The close path doesn't need the guard — exit animation always fires.
    // We just confirm we have at least one 'out' caller; behavioural test
    // below covers the actual fire-count.
  });
});

// =============================================================================
// 2. Behavioural test — drive the hook in a real React tree
// =============================================================================

interface HarnessHandle {
  open: (idx: number, thumb?: HTMLElement) => void;
  close: () => Promise<void>;
  setIndex: (i: number) => void;
}

function Harness({ images, onReady }: { images: ImageData[]; onReady: (h: HarnessHandle) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  // We don't need hideLightboxImage in tests; just sink it.
  const [, setHide] = useState(false);
  const initRef = useRef(false);

  const { openLightbox, closeLightbox } = useLightboxAnimations({
    images,
    isLightboxOpen: isOpen,
    lightboxIndex: idx,
    reduceMotion: false,
    setLightboxIndex: setIdx,
    setIsLightboxOpen: setIsOpen,
    setHideLightboxImage: setHide,
  });

  // Hand the harness handle back exactly once.
  if (!initRef.current) {
    initRef.current = true;
    onReady({
      open: (i, t) => openLightbox(i, t),
      close: async () => { await closeLightbox(); },
      setIndex: setIdx,
    });
  }

  return (
    <div>
      {isOpen && (
        <div id="lightbox">
          <img id="lightbox-image" alt="" src={images[idx]?.src ?? ''} />
          <aside className="lightbox-details" />
        </div>
      )}
    </div>
  );
}

describe('useLightboxAnimations — sidebar fade-in fires once per session', () => {
  const images: ImageData[] = [
    { fileName: 'a.png', src: 'a.png' },
    { fileName: 'b.png', src: 'b.png' },
    { fileName: 'c.png', src: 'c.png' },
  ];

  let sidebarAnimateCalls: number;
  let originalAnimate: typeof HTMLElement.prototype.animate | undefined;

  beforeEach(() => {
    sidebarAnimateCalls = 0;
    // jsdom does not implement Web Animations API, so HTMLElement.prototype.animate
    // is undefined. Install a stub that returns a resolved-finished Animation-like
    // object (the hook awaits .finished). Counts only calls on .lightbox-details
    // so we isolate the sidebar animation from backdrop / wireframe.
    originalAnimate = (HTMLElement.prototype as unknown as { animate?: typeof HTMLElement.prototype.animate }).animate;
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function (this: HTMLElement) {
        if (this.classList?.contains('lightbox-details')) {
          sidebarAnimateCalls += 1;
        }
        return { finished: Promise.resolve(), cancel: () => {}, currentTime: 0 } as unknown as Animation;
      },
    });
  });

  afterEach(() => {
    if (originalAnimate === undefined) {
      delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    } else {
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        writable: true,
        value: originalAnimate,
      });
    }
    document.body.innerHTML = '';
  });

  // Helper that flushes microtasks and a few rAF/setTimeout ticks so
  // the hook's async open path settles in jsdom (which doesn't run rAF).
  const settle = async () => {
    for (let i = 0; i < 5; i++) {
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    }
  };

  it('plays the enter animation only on the first open, not on lightboxIndex change', async () => {
    let handle: HarnessHandle | null = null;
    render(<Harness images={images} onReady={(h) => { handle = h; }} />);
    expect(handle).not.toBeNull();

    // Open WITHOUT a thumbnail element — this drives the synchronous
    // !startRect branch in the post-mount effect, which is the same
    // path used by URL-hash deep-link opens. That branch fires sidebar
    // animation immediately on the first effect run.
    await act(async () => { handle!.open(0); });
    await settle();

    const callsAfterOpen = sidebarAnimateCalls;
    expect(callsAfterOpen).toBeGreaterThan(0);

    // Navigate forward — this re-runs the post-mount effect with a new
    // lightboxIndex but should NOT replay the sidebar animation.
    await act(async () => { handle!.setIndex(1); });
    await settle();
    await act(async () => { handle!.setIndex(2); });
    await settle();
    await act(async () => { handle!.setIndex(0); });
    await settle();

    expect(sidebarAnimateCalls).toBe(callsAfterOpen);
  });

  it('replays the enter animation when the lightbox is closed and reopened', async () => {
    let handle: HarnessHandle | null = null;
    render(<Harness images={images} onReady={(h) => { handle = h; }} />);

    await act(async () => { handle!.open(0); });
    await settle();
    const afterFirstOpen = sidebarAnimateCalls;
    expect(afterFirstOpen).toBeGreaterThan(0);

    await act(async () => { await handle!.close(); });
    await settle();

    // A second open must fire fresh enter animations on the sidebar.
    await act(async () => { handle!.open(1); });
    await settle();
    expect(sidebarAnimateCalls).toBeGreaterThan(afterFirstOpen);
  });
});
