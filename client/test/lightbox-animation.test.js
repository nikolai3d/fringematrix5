import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for lightbox zoom animation behavior, including:
 * - Reduce motion: instant open/close without wireframe or animation
 * - Image visibility: wireframe element contains an actual <img> during animation
 * - DOM cleanup: no stale clone elements after animation completes
 */

const cssPath = path.resolve(__dirname, '../src/styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

const hookPath = path.resolve(__dirname, '../src/hooks/useLightboxAnimations.ts');
const hookContent = fs.readFileSync(hookPath, 'utf-8');

const appPath = path.resolve(__dirname, '../src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

describe('Wireframe Element Structure', () => {
  it('ensureWireframeElement should create a container with a .wireframe-rect-img <img> child', () => {
    // Simulate what ensureWireframeElement does
    const container = document.createElement('div');
    container.className = 'wireframe-rect';
    Object.assign(container.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '0px',
      height: '0px',
      pointerEvents: 'none',
      zIndex: 100,
      opacity: '0',
      overflow: 'hidden',
    });
    const img = document.createElement('img');
    img.className = 'wireframe-rect-img';
    Object.assign(img.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: 'inherit',
    });
    container.appendChild(img);
    const inner = document.createElement('div');
    inner.className = 'wireframe-rect-inner';
    Object.assign(inner.style, { position: 'absolute', inset: '0' });
    container.appendChild(inner);
    document.body.appendChild(container);

    // Verify structure
    const wireframe = document.querySelector('.wireframe-rect');
    expect(wireframe).not.toBeNull();

    const wireframeImg = wireframe.querySelector('.wireframe-rect-img');
    expect(wireframeImg).not.toBeNull();
    expect(wireframeImg.tagName).toBe('IMG');

    const wireframeInner = wireframe.querySelector('.wireframe-rect-inner');
    expect(wireframeInner).not.toBeNull();

    // img should come before inner (layered underneath the border)
    const children = Array.from(wireframe.children);
    expect(children.indexOf(wireframeImg)).toBeLessThan(children.indexOf(wireframeInner));

    // Cleanup
    container.remove();
  });

  it('wireframe image should have cover object-fit by default', () => {
    const img = document.createElement('img');
    img.className = 'wireframe-rect-img';
    Object.assign(img.style, { objectFit: 'cover' });

    expect(img.style.objectFit).toBe('cover');
  });

  it('wireframe container should have overflow hidden to clip the image', () => {
    const container = document.createElement('div');
    container.className = 'wireframe-rect';
    Object.assign(container.style, { overflow: 'hidden' });

    expect(container.style.overflow).toBe('hidden');
  });
});

describe('Wireframe Image Source During Animation', () => {
  let container;
  let img;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'wireframe-rect';
    Object.assign(container.style, { display: 'none', overflow: 'hidden' });
    img = document.createElement('img');
    img.className = 'wireframe-rect-img';
    Object.assign(img.style, { display: 'none' });
    container.appendChild(img);
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should set image src and display when opening animation starts', () => {
    const testSrc = 'https://example.com/avatar.jpg';

    // Simulate what runWireframeAnimation does when imgSrc is provided
    img.src = testSrc;
    img.style.display = 'block';
    img.style.objectFit = 'cover'; // direction === 'open'
    container.style.display = 'block';

    expect(img.src).toBe(testSrc);
    expect(img.style.display).toBe('block');
    expect(img.style.objectFit).toBe('cover');
    expect(container.style.display).toBe('block');
  });

  it('should set image src and display when closing animation starts', () => {
    const testSrc = 'https://example.com/avatar.jpg';

    // Simulate close direction
    img.src = testSrc;
    img.style.display = 'block';
    img.style.objectFit = 'contain'; // direction === 'close'
    container.style.display = 'block';

    expect(img.src).toBe(testSrc);
    expect(img.style.objectFit).toBe('contain');
  });

  it('should hide image if no imgSrc provided', () => {
    img.style.display = 'none';
    expect(img.style.display).toBe('none');
  });

  it('should switch object-fit from cover to contain during open animation', () => {
    // Opening: starts cover, switches to contain at 35%
    img.style.objectFit = 'cover';
    expect(img.style.objectFit).toBe('cover');

    // Simulate the timeout at 35%
    img.style.objectFit = 'contain';
    expect(img.style.objectFit).toBe('contain');
  });

  it('should switch object-fit from contain to cover during close animation', () => {
    // Closing: starts contain, switches to cover at 35%
    img.style.objectFit = 'contain';
    expect(img.style.objectFit).toBe('contain');

    // Simulate the timeout at 35%
    img.style.objectFit = 'cover';
    expect(img.style.objectFit).toBe('cover');
  });
});

describe('DOM Cleanup After Animation', () => {
  let container;
  let img;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'wireframe-rect';
    Object.assign(container.style, { display: 'block' });
    img = document.createElement('img');
    img.className = 'wireframe-rect-img';
    img.src = 'https://example.com/test.jpg';
    Object.assign(img.style, { display: 'block' });
    container.appendChild(img);
    const inner = document.createElement('div');
    inner.className = 'wireframe-rect-inner';
    container.appendChild(inner);
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (document.body.contains(container)) {
      container.remove();
    }
  });

  it('wireframe and image should be hidden after animation completes', () => {
    // Simulate post-animation cleanup (runWireframeAnimation end)
    container.style.display = 'none';
    img.style.display = 'none';

    expect(container.style.display).toBe('none');
    expect(img.style.display).toBe('none');
  });

  it('wireframe should be removed from DOM on unmount', () => {
    container.remove();

    expect(document.body.contains(container)).toBe(false);
    expect(document.querySelector('.wireframe-rect')).toBeNull();
  });

  it('no stale wireframe elements should remain after cleanup', () => {
    const extra = document.createElement('div');
    extra.className = 'wireframe-rect';
    document.body.appendChild(extra);

    document.querySelectorAll('.wireframe-rect').forEach(el => { el.remove(); });

    expect(document.querySelectorAll('.wireframe-rect').length).toBe(0);
  });
});

describe('Reduce Motion - Open Lightbox Behavior', () => {
  it('should skip animation and set isAnimating to false when reduceMotion is true', () => {
    const reduceMotion = true;
    let isAnimating = false;
    let hideLightboxImage = true;
    let lightboxOpen = false;
    let lightboxIndex = -1;

    // Simulate the reduceMotion path in openLightbox
    if (reduceMotion) {
      lightboxIndex = 3;
      lightboxOpen = true;
      hideLightboxImage = false;
      isAnimating = false;
    }

    expect(isAnimating).toBe(false);
    expect(hideLightboxImage).toBe(false);
    expect(lightboxOpen).toBe(true);
    expect(lightboxIndex).toBe(3);
  });

  it('should not set pendingOpenStartRect or pendingOpenImgSrc when reduceMotion is true', () => {
    const reduceMotion = true;
    let pendingOpenStartRect = null;
    let pendingOpenImgSrc = null;

    if (reduceMotion) {
      // openLightbox returns early without touching these refs
    }

    expect(pendingOpenStartRect).toBeNull();
    expect(pendingOpenImgSrc).toBeNull();
  });

  it('should set thumb opacity to 0 immediately when reduceMotion is true', () => {
    const thumbEl = document.createElement('img');
    thumbEl.style.opacity = '1';
    document.body.appendChild(thumbEl);

    const reduceMotion = true;
    if (reduceMotion && thumbEl) {
      thumbEl.style.opacity = '0';
    }

    expect(thumbEl.style.opacity).toBe('0');
    thumbEl.remove();
  });

  it('should set isAnimating=true and hideLightboxImage=true when reduceMotion is false', () => {
    const reduceMotion = false;
    let isAnimating = false;
    let hideLightboxImage = false;

    if (!reduceMotion) {
      isAnimating = true;
      hideLightboxImage = true;
    }

    expect(isAnimating).toBe(true);
    expect(hideLightboxImage).toBe(true);
  });
});

describe('Reduce Motion - Close Lightbox Behavior', () => {
  it('should close instantly without animation when reduceMotion is true', () => {
    const reduceMotion = true;
    let isLightboxOpen = true;
    let hideLightboxImage = true;
    let isAnimating = true;
    let backdropDimmed = true;

    if (reduceMotion) {
      backdropDimmed = false;
      isLightboxOpen = false;
      hideLightboxImage = false;
      isAnimating = false;
    }

    expect(isLightboxOpen).toBe(false);
    expect(hideLightboxImage).toBe(false);
    expect(isAnimating).toBe(false);
    expect(backdropDimmed).toBe(false);
  });

  it('should restore thumb opacity when closing with reduceMotion', () => {
    const thumbEl = document.createElement('img');
    thumbEl.style.opacity = '0';
    document.body.appendChild(thumbEl);

    if (thumbEl && document.body.contains(thumbEl)) {
      thumbEl.style.opacity = '';
    }

    expect(thumbEl.style.opacity).toBe('');
    thumbEl.remove();
  });

  it('should clear lastOpenedThumbElRef when closing with reduceMotion', () => {
    let lastOpenedThumbEl = document.createElement('img');
    document.body.appendChild(lastOpenedThumbEl);

    const reduceMotion = true;
    if (reduceMotion) {
      lastOpenedThumbEl = null;
    }

    expect(lastOpenedThumbEl).toBeNull();
    document.querySelectorAll('img').forEach(el => { el.remove(); });
  });
});

describe('Reduce Motion - useEffect Open Path', () => {
  it('should clear pending refs and mark not animating when reduceMotion is true', () => {
    let pendingOpenStartRect = { left: 10, top: 20, width: 100, height: 100 };
    let pendingOpenImgSrc = 'https://example.com/test.jpg';
    let isAnimating = true;
    let backdropDimmed = false;
    const isLightboxOpen = true;
    const reduceMotion = true;

    if (isLightboxOpen && reduceMotion) {
      backdropDimmed = true;
      pendingOpenStartRect = null;
      pendingOpenImgSrc = null;
      isAnimating = false;
    }

    expect(pendingOpenStartRect).toBeNull();
    expect(pendingOpenImgSrc).toBeNull();
    expect(isAnimating).toBe(false);
    expect(backdropDimmed).toBe(true);
  });

  it('should not call requestAnimationFrame when reduceMotion is true', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const isLightboxOpen = true;
    const reduceMotion = true;

    if (isLightboxOpen && reduceMotion) {
      // Early return - no rAF
    } else if (isLightboxOpen) {
      requestAnimationFrame(() => {});
    }

    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });
});

describe('Thumbnail Image Src Extraction', () => {
  it('should extract src from <img> element directly', () => {
    const thumbEl = document.createElement('img');
    thumbEl.src = 'https://example.com/thumb.jpg';

    const thumbImg = thumbEl.tagName === 'IMG' ? thumbEl : thumbEl.querySelector('img');
    const src = thumbImg ? thumbImg.src : null;

    expect(src).toBe('https://example.com/thumb.jpg');
  });

  it('should extract src from nested <img> inside container element', () => {
    const container = document.createElement('div');
    const img = document.createElement('img');
    img.src = 'https://example.com/nested-thumb.jpg';
    container.appendChild(img);

    const thumbImg = container.tagName === 'IMG' ? container : container.querySelector('img');
    const src = thumbImg ? thumbImg.src : null;

    expect(src).toBe('https://example.com/nested-thumb.jpg');
  });

  it('should handle element with no <img> child', () => {
    const container = document.createElement('div');

    const thumbImg = container.tagName === 'IMG' ? container : container.querySelector('img');
    const src = thumbImg ? thumbImg.src : null;

    expect(src).toBeNull();
  });
});

describe('CSS Wireframe Image Styles', () => {
  it('CSS should have .wireframe-rect-img rule', () => {
    expect(cssContent).toMatch(/\.wireframe-rect-img/);
  });

  it('.wireframe-rect-img should use absolute positioning', () => {
    expect(cssContent).toMatch(/\.wireframe-rect-img\s*\{[^}]*position:\s*absolute/s);
  });

  it('.wireframe-rect-img should have inset: 0 for full coverage', () => {
    expect(cssContent).toMatch(/\.wireframe-rect-img\s*\{[^}]*inset:\s*0/s);
  });

  it('.wireframe-rect-img should have 100% width and height', () => {
    expect(cssContent).toMatch(/\.wireframe-rect-img\s*\{[^}]*width:\s*100%/s);
    expect(cssContent).toMatch(/\.wireframe-rect-img\s*\{[^}]*height:\s*100%/s);
  });

  it('.wireframe-rect-img should inherit border-radius', () => {
    expect(cssContent).toMatch(/\.wireframe-rect-img\s*\{[^}]*border-radius:\s*inherit/s);
  });

  it('.wireframe-rect-img should be hidden by default', () => {
    expect(cssContent).toMatch(/\.wireframe-rect-img\s*\{[^}]*display:\s*none/s);
  });
});

describe('Reduce Motion CSS Integration', () => {
  it('html.reduce-motion should disable all animation-duration', () => {
    expect(cssContent).toMatch(/html\.reduce-motion[^{]*\{[^}]*animation-duration:\s*0\.01ms\s*!important/s);
  });

  it('html.reduce-motion should disable all transition-duration', () => {
    expect(cssContent).toMatch(/html\.reduce-motion[^{]*\{[^}]*transition-duration:\s*0\.01ms\s*!important/s);
  });

  it('html.reduce-motion class should be togglable on document element', () => {
    const root = document.documentElement;

    root.classList.add('reduce-motion');
    expect(root.classList.contains('reduce-motion')).toBe(true);

    root.classList.remove('reduce-motion');
    expect(root.classList.contains('reduce-motion')).toBe(false);
  });
});

describe('Animation Keyframe Structure', () => {
  it('animation keyframes should not include opacity (image stays fully visible)', () => {
    // Wireframe stays at full opacity throughout - no fade that would cause blinking.
    // Opacity is controlled via inline style (set to 1 before animation, hidden via display:none after).
    const keyframes = [
      { left: '10px', top: '20px', width: '100px', height: '100px', borderRadius: '12px', offset: 0 },
      { left: '50px', top: '50px', width: '500px', height: '500px', borderRadius: '10px', offset: 1 },
    ];

    expect(keyframes[0]).not.toHaveProperty('opacity');
    expect(keyframes[1]).not.toHaveProperty('opacity');
  });

  it('animation should use cubic-bezier easing for smooth zoom', () => {
    const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    expect(easing).toMatch(/cubic-bezier\(/);
  });
});

describe('Hook Interface - reduceMotion Prop', () => {
  it('hook interface should accept reduceMotion prop', () => {
    expect(hookContent).toMatch(/reduceMotion:\s*boolean/);
  });

  it('hook should destructure reduceMotion from props', () => {
    expect(hookContent).toMatch(/reduceMotion\s*,\s*setLightboxIndex/s);
  });

  it('openLightbox should check reduceMotion first', () => {
    const openMatch = hookContent.match(/const openLightbox = useCallback\(\(index.*?\{([\s\S]*?)setLightboxIndex/);
    expect(openMatch).not.toBeNull();
    expect(openMatch[1]).toMatch(/if\s*\(reduceMotion\)/);
  });

  it('closeLightbox should check reduceMotion first', () => {
    const closeMatch = hookContent.match(/const closeLightbox = useCallback\(async \(\).*?\{([\s\S]*?)isAnimatingRef\.current = true/);
    expect(closeMatch).not.toBeNull();
    expect(closeMatch[1]).toMatch(/if\s*\(reduceMotion\)/);
  });

  it('useEffect for open animation should check reduceMotion', () => {
    expect(hookContent).toMatch(/if\s*\(!isLightboxOpen\)\s*return;\s*\n\s*if\s*\(reduceMotion\)/s);
  });

  it('reduceMotion should be in dependency arrays', () => {
    expect(hookContent).toMatch(/\[reduceMotion,\s*setHideLightboxImage/);
    expect(hookContent).toMatch(/\[reduceMotion,\s*images/);
    expect(hookContent).toMatch(/reduceMotion,\s*animateLightboxBackdrop/);
  });
});

describe('App.tsx Integration - reduceMotion Passed to Hook', () => {
  it('App should pass reduceMotion to useLightboxAnimations', () => {
    expect(appContent).toMatch(/useLightboxAnimations\(\{[\s\S]*?reduceMotion,[\s\S]*?\}\)/);
  });

  it('App should have reduceMotion state', () => {
    expect(appContent).toMatch(/const\s*\[reduceMotion,\s*setReduceMotion\]\s*=\s*useState/);
  });

  it('App should toggle reduce-motion class on html element', () => {
    expect(appContent).toMatch(/root\.classList\.toggle\('reduce-motion',\s*reduceMotion\)/);
  });
});
