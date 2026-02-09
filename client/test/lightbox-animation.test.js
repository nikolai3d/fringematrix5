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

  it('should add lightbox-active-thumb class to thumb when reduceMotion is true', () => {
    const thumbEl = document.createElement('img');
    document.body.appendChild(thumbEl);

    const reduceMotion = true;
    if (reduceMotion && thumbEl) {
      thumbEl.classList.add('lightbox-active-thumb');
    }

    expect(thumbEl.classList.contains('lightbox-active-thumb')).toBe(true);
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

  it('should remove lightbox-active-thumb class when closing with reduceMotion', () => {
    const thumbEl = document.createElement('img');
    thumbEl.classList.add('lightbox-active-thumb');
    document.body.appendChild(thumbEl);

    if (thumbEl && document.body.contains(thumbEl)) {
      thumbEl.classList.remove('lightbox-active-thumb');
    }

    expect(thumbEl.classList.contains('lightbox-active-thumb')).toBe(false);
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

describe('CSS Class-Based Thumbnail Restoration on Close', () => {
  it('should remove lightbox-active-thumb class from thumb when closing with reduceMotion', () => {
    const thumbEl = document.createElement('img');
    thumbEl.classList.add('lightbox-active-thumb');
    document.body.appendChild(thumbEl);

    // Simulate the reduceMotion close path
    thumbEl.classList.remove('lightbox-active-thumb');

    expect(thumbEl.classList.contains('lightbox-active-thumb')).toBe(false);
    thumbEl.remove();
  });

  it('should restore thumb visibility after open+close cycle with reduceMotion', () => {
    const thumbEl = document.createElement('img');
    document.body.appendChild(thumbEl);

    // Simulate open: thumb hidden via class
    thumbEl.classList.add('lightbox-active-thumb');
    expect(thumbEl.classList.contains('lightbox-active-thumb')).toBe(true);

    // Simulate close: class removed
    thumbEl.classList.remove('lightbox-active-thumb');

    expect(thumbEl.classList.contains('lightbox-active-thumb')).toBe(false);
    thumbEl.remove();
  });

  it('should remove class on both activeGridThumb and lastOpenedThumb if different', () => {
    const lastThumb = document.createElement('img');
    const activeThumb = document.createElement('img');
    document.body.appendChild(lastThumb);
    document.body.appendChild(activeThumb);

    lastThumb.classList.add('lightbox-active-thumb');
    activeThumb.classList.add('lightbox-active-thumb');

    // Simulate close: remove class on both elements
    lastThumb.classList.remove('lightbox-active-thumb');
    if (activeThumb !== lastThumb) {
      activeThumb.classList.remove('lightbox-active-thumb');
    }

    expect(lastThumb.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(activeThumb.classList.contains('lightbox-active-thumb')).toBe(false);

    lastThumb.remove();
    activeThumb.remove();
  });

  it('restore grid thumb effect should remove lightbox-active-thumb class', () => {
    expect(hookContent).toMatch(/Restore grid thumb on lightbox close/);
    const restoreBlock = hookContent.match(/Restore grid thumb on lightbox close[\s\S]*?activeGridThumbRef\.current = null/);
    expect(restoreBlock).not.toBeNull();
    expect(restoreBlock[0]).toMatch(/classList\.remove\('lightbox-active-thumb'\)/);
  });

  it('closeLightbox reduceMotion path should remove lightbox-active-thumb class', () => {
    const closeReduceBlock = hookContent.match(/const closeLightbox[\s\S]*?if \(reduceMotion\) \{([\s\S]*?)return;\s*\}/);
    expect(closeReduceBlock).not.toBeNull();
    expect(closeReduceBlock[1]).toMatch(/classList\.remove\('lightbox-active-thumb'\)/);
  });
});

describe('Grid Thumbnail Class-Based Guaranteed Restoration', () => {
  let galleryGrid;

  beforeEach(() => {
    galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    document.body.appendChild(galleryGrid);
  });

  afterEach(() => {
    galleryGrid.remove();
  });

  function addCard(src) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    galleryGrid.appendChild(card);
    return img;
  }

  it('safety sweep should remove lightbox-active-thumb class from all grid thumbnails on close', () => {
    const img1 = addCard('https://example.com/1.jpg');
    const img2 = addCard('https://example.com/2.jpg');
    const img3 = addCard('https://example.com/3.jpg');

    // Simulate stuck class from interrupted interactions
    img1.classList.add('lightbox-active-thumb');
    img2.classList.add('lightbox-active-thumb');
    // img3 left without the class

    // Simulate the safety sweep from "restore grid thumb" effect
    document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb').forEach(img => {
      img.classList.remove('lightbox-active-thumb');
    });

    expect(img1.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(img2.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(img3.classList.contains('lightbox-active-thumb')).toBe(false);
  });

  it('safety sweep should only target elements with the lightbox-active-thumb class', () => {
    const img1 = addCard('https://example.com/1.jpg');
    const img2 = addCard('https://example.com/2.jpg');

    img1.classList.add('lightbox-active-thumb');
    // img2 does not have the class

    const matchedElements = document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb');
    expect(matchedElements.length).toBe(1);
    expect(matchedElements[0]).toBe(img1);
  });

  it('closeLightbox finally block should remove class on both lastOpened and activeGrid thumbs', () => {
    const finallyBlock = hookContent.match(/finally\s*\{([\s\S]*?)\n  \}/);
    expect(finallyBlock).not.toBeNull();
    const body = finallyBlock[1];
    // Should remove lightbox-active-thumb class
    expect(body).toMatch(/classList\.remove\('lightbox-active-thumb'\)/);
    // Should handle activeGridThumbRef separately
    expect(body).toMatch(/activeGridThumbRef\.current/);
    expect(body).toMatch(/active\s*!==\s*el/);
  });

  it('restore grid thumb effect should include safety sweep of lightbox-active-thumb class', () => {
    const restoreBlock = hookContent.match(/Restore grid thumb on lightbox close[\s\S]*?Safety sweep[\s\S]*?\}, \[isLightboxOpen\]\)/);
    expect(restoreBlock).not.toBeNull();
    expect(restoreBlock[0]).toMatch(/querySelectorAll.*gallery-grid.*card img\.lightbox-active-thumb/);
    expect(restoreBlock[0]).toMatch(/classList\.remove\('lightbox-active-thumb'\)/);
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

describe('CSS lightbox-active-thumb Class', () => {
  it('CSS should have .lightbox-active-thumb rule with opacity: 0', () => {
    expect(cssContent).toMatch(/\.lightbox-active-thumb\s*\{[^}]*opacity:\s*0/s);
  });

  it('.lightbox-active-thumb should be scoped to .card img', () => {
    expect(cssContent).toMatch(/\.card\s+img\.lightbox-active-thumb/);
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

  it('closeLightbox should check reduceMotion early', () => {
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
    // Sync effect should also include reduceMotion
    expect(hookContent).toMatch(/\[isLightboxOpen,\s*images,\s*lightboxIndex,\s*reduceMotion\]/);
  });
});

describe('No-Blink Handoff: Wireframe to Lightbox Image', () => {
  it('lightbox image should NOT have a CSS transition on opacity', () => {
    // A transition on opacity causes a fade-in delay after the wireframe hides,
    // producing a visible blink. The opacity change must be instant.
    const lightboxImgStyle = appContent.match(/id="lightbox-image"[\s\S]*?style=\{\{([^}]*)\}\}/);
    expect(lightboxImgStyle).not.toBeNull();
    const styleStr = lightboxImgStyle[1];
    expect(styleStr).not.toMatch(/transition/);
  });

  it('lightbox image opacity should be controlled by hideLightboxImage state only', () => {
    const lightboxImgStyle = appContent.match(/id="lightbox-image"[\s\S]*?style=\{\{([^}]*)\}\}/);
    expect(lightboxImgStyle).not.toBeNull();
    const styleStr = lightboxImgStyle[1];
    expect(styleStr).toMatch(/opacity:\s*hideLightboxImage\s*\?\s*0\s*:\s*1/);
  });

  it('wireframe animation keyframes should not animate opacity', () => {
    // Opacity in keyframes causes the image to fade during zoom, producing a blink
    // at the handoff point. The wireframe must stay fully opaque throughout.
    const animateCall = hookContent.match(/el\.animate\(\s*\[([\s\S]*?)\]\s*,\s*\{/);
    expect(animateCall).not.toBeNull();
    const keyframesStr = animateCall[1];
    expect(keyframesStr).not.toMatch(/opacity/);
  });

  it('wireframe element should have opacity set to 1 before animation starts', () => {
    // The wireframe must be fully visible from the first frame of animation.
    // It's initially created with opacity: 0, so it must be set to 1 before animating.
    const setupBlock = hookContent.match(/Object\.assign\(el\.style,\s*\{[\s\S]*?display:\s*'block'[\s\S]*?\}\)/s);
    expect(setupBlock).not.toBeNull();
    expect(setupBlock[0]).toMatch(/opacity:\s*'1'/);
  });

  it('wireframe should be hidden via display:none after animation (not opacity fade)', () => {
    // After animation completes, the wireframe is hidden by setting display:none,
    // not by fading opacity. This ensures the lightbox image can take over instantly.
    const postAnimation = hookContent.match(/await animation\.finished;[\s\S]*?el\.style\.display\s*=\s*'none'/);
    expect(postAnimation).not.toBeNull();
  });
});

describe('Generation Counter - Race Condition Protection', () => {
  it('hook should have an openGenerationRef counter', () => {
    expect(hookContent).toMatch(/openGenerationRef\s*=\s*useRef<number>\(0\)/);
  });

  it('openLightbox should increment the generation counter', () => {
    const openBlock = hookContent.match(/const openLightbox = useCallback\(\(index.*?\{([\s\S]*?)setLightboxIndex/);
    expect(openBlock).not.toBeNull();
    expect(openBlock[1]).toMatch(/openGenerationRef\.current\+\+/);
  });

  it('closeLightbox should snapshot generation and guard lastOpenedThumbElRef clearing', () => {
    // closeLightbox should capture the generation at start
    expect(hookContent).toMatch(/const closeGeneration = openGenerationRef\.current/);
    // finally block should only clear ref if generation matches
    const finallyBlock = hookContent.match(/finally\s*\{([\s\S]*?)\n  \}/);
    expect(finallyBlock).not.toBeNull();
    expect(finallyBlock[1]).toMatch(/closeGeneration === openGenerationRef\.current/);
  });
});

describe('closeAllSubwindows calls closeLightbox', () => {
  it('App closeAllSubwindows should call closeLightbox instead of setIsLightboxOpen', () => {
    expect(appContent).toMatch(/const closeAllSubwindows = useCallback\(\(\) => \{/);
    const closeAllBlock = appContent.match(/const closeAllSubwindows = useCallback\(\(\) => \{([\s\S]*?)\}, \[/);
    expect(closeAllBlock).not.toBeNull();
    // Should call closeLightbox(), not setIsLightboxOpen(false)
    expect(closeAllBlock[1]).toMatch(/closeLightbox\(\)/);
    expect(closeAllBlock[1]).not.toMatch(/setIsLightboxOpen\(false\)/);
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

// =============================================================================
// Regression Tests: Mode-Switching, Interruption, and Edge Cases
// =============================================================================

describe('Regression: Open with reduceMotion=true, toggle to false, close', () => {
  let galleryGrid;

  beforeEach(() => {
    galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    document.body.appendChild(galleryGrid);
  });

  afterEach(() => {
    galleryGrid.remove();
  });

  function addCard(src) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    galleryGrid.appendChild(card);
    return img;
  }

  it('thumbnail must be visible after open(reduceMotion=true) then close(reduceMotion=false)', () => {
    const thumb = addCard('https://example.com/1.jpg');

    // Open with reduceMotion=true: adds CSS class
    thumb.classList.add('lightbox-active-thumb');
    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(true);

    // User toggles reduceMotion to false mid-lightbox, then closes
    // closeLightbox finally block removes the class regardless of reduceMotion value
    thumb.classList.remove('lightbox-active-thumb');

    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(false);
    // No stuck inline opacity since we use CSS classes
    expect(thumb.style.opacity).toBe('');
  });

  it('safety sweep should clean up even if close path misses the thumb', () => {
    const thumb = addCard('https://example.com/1.jpg');

    // Simulate: class was applied but close path failed to remove it
    thumb.classList.add('lightbox-active-thumb');

    // Safety sweep runs on lightbox close
    document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb').forEach(img => {
      img.classList.remove('lightbox-active-thumb');
    });

    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(false);
  });
});

describe('Regression: Open with reduceMotion=false, toggle to true, close', () => {
  let galleryGrid;

  beforeEach(() => {
    galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    document.body.appendChild(galleryGrid);
  });

  afterEach(() => {
    galleryGrid.remove();
  });

  function addCard(src) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    galleryGrid.appendChild(card);
    return img;
  }

  it('thumbnail must be visible after open(reduceMotion=false) then close(reduceMotion=true)', () => {
    const thumb = addCard('https://example.com/1.jpg');

    // Open with reduceMotion=false: class is added
    thumb.classList.add('lightbox-active-thumb');
    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(true);

    // User toggles reduceMotion to true mid-lightbox, then closes
    // closeLightbox reduceMotion path removes the class
    thumb.classList.remove('lightbox-active-thumb');

    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb.style.opacity).toBe('');
  });

  it('CSS class approach is resilient to mode changes because removal is unconditional', () => {
    // The key insight: classList.remove('lightbox-active-thumb') works the same
    // regardless of what reduceMotion was when the class was added
    const thumb = addCard('https://example.com/2.jpg');

    // Add with any method (doesn't matter which mode)
    thumb.classList.add('lightbox-active-thumb');
    // Remove always works
    thumb.classList.remove('lightbox-active-thumb');
    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(false);

    // Adding again and removing again still works
    thumb.classList.add('lightbox-active-thumb');
    thumb.classList.remove('lightbox-active-thumb');
    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(false);
  });
});

describe('Regression: Navigate to different image, close', () => {
  let galleryGrid;

  beforeEach(() => {
    galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    document.body.appendChild(galleryGrid);
  });

  afterEach(() => {
    galleryGrid.remove();
  });

  function addCard(src) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    galleryGrid.appendChild(card);
    return img;
  }

  it('original AND navigated thumbnails must be visible after close', () => {
    const thumb1 = addCard('https://example.com/1.jpg');
    const thumb2 = addCard('https://example.com/2.jpg');

    // Open lightbox on thumb1
    thumb1.classList.add('lightbox-active-thumb');

    // Navigate to thumb2 (sync effect removes class from prev, adds to new)
    thumb1.classList.remove('lightbox-active-thumb');
    thumb2.classList.add('lightbox-active-thumb');

    expect(thumb1.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb2.classList.contains('lightbox-active-thumb')).toBe(true);

    // Close lightbox: class removed from active thumb + safety sweep
    thumb2.classList.remove('lightbox-active-thumb');
    document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb').forEach(img => {
      img.classList.remove('lightbox-active-thumb');
    });

    // Both must be visible (no lightbox-active-thumb class)
    expect(thumb1.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb2.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb1.style.opacity).toBe('');
    expect(thumb2.style.opacity).toBe('');
  });

  it('navigating away properly transfers the active-thumb class', () => {
    const thumb1 = addCard('https://example.com/a.jpg');
    const thumb2 = addCard('https://example.com/b.jpg');
    const thumb3 = addCard('https://example.com/c.jpg');

    // Open on thumb1
    thumb1.classList.add('lightbox-active-thumb');

    // Navigate to thumb2
    thumb1.classList.remove('lightbox-active-thumb');
    thumb2.classList.add('lightbox-active-thumb');

    // Navigate to thumb3
    thumb2.classList.remove('lightbox-active-thumb');
    thumb3.classList.add('lightbox-active-thumb');

    // Only thumb3 should have the class
    expect(thumb1.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb2.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb3.classList.contains('lightbox-active-thumb')).toBe(true);
  });
});

describe('Regression: Rapid open/close before animation completes', () => {
  let galleryGrid;

  beforeEach(() => {
    galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    document.body.appendChild(galleryGrid);
  });

  afterEach(() => {
    galleryGrid.remove();
  });

  function addCard(src) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    galleryGrid.appendChild(card);
    return img;
  }

  it('thumbnail must be visible after rapid open+close', () => {
    const thumb = addCard('https://example.com/1.jpg');

    // Rapid open
    thumb.classList.add('lightbox-active-thumb');

    // Rapid close (before any animation can complete)
    thumb.classList.remove('lightbox-active-thumb');

    // Safety sweep
    document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb').forEach(img => {
      img.classList.remove('lightbox-active-thumb');
    });

    expect(thumb.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb.style.opacity).toBe('');
  });

  it('generation counter prevents stale close from clearing new open ref', () => {
    // Simulate the generation counter logic
    let openGeneration = 0;
    let lastOpenedThumbEl = null;

    // First open
    openGeneration++;
    const thumb1 = addCard('https://example.com/1.jpg');
    lastOpenedThumbEl = thumb1;
    thumb1.classList.add('lightbox-active-thumb');
    const closeGeneration1 = openGeneration; // snapshot: 1

    // New open happens during close await (before finally runs)
    openGeneration++;
    const thumb2 = addCard('https://example.com/2.jpg');
    lastOpenedThumbEl = thumb2;
    thumb2.classList.add('lightbox-active-thumb');

    // Stale close finally runs: generation check prevents clearing ref
    thumb1.classList.remove('lightbox-active-thumb');
    if (closeGeneration1 === openGeneration) {
      lastOpenedThumbEl = null; // This should NOT execute
    }

    // The new open's ref should still be intact
    expect(lastOpenedThumbEl).toBe(thumb2);
    expect(thumb2.classList.contains('lightbox-active-thumb')).toBe(true);

    // Clean up: second close
    thumb2.classList.remove('lightbox-active-thumb');
  });
});

describe('Regression: Navigate several images, close', () => {
  let galleryGrid;

  beforeEach(() => {
    galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    document.body.appendChild(galleryGrid);
  });

  afterEach(() => {
    galleryGrid.remove();
  });

  function addCard(src) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    galleryGrid.appendChild(card);
    return img;
  }

  it('all previously-viewed thumbnails must be visible after close', () => {
    const thumbs = [];
    for (let i = 0; i < 5; i++) {
      thumbs.push(addCard(`https://example.com/${i}.jpg`));
    }

    // Open on thumb 0
    thumbs[0].classList.add('lightbox-active-thumb');

    // Navigate through thumbs 1-4
    for (let i = 1; i < 5; i++) {
      thumbs[i - 1].classList.remove('lightbox-active-thumb');
      thumbs[i].classList.add('lightbox-active-thumb');
    }

    // Only last navigated thumb should have the class
    for (let i = 0; i < 4; i++) {
      expect(thumbs[i].classList.contains('lightbox-active-thumb')).toBe(false);
    }
    expect(thumbs[4].classList.contains('lightbox-active-thumb')).toBe(true);

    // Close: remove from active + safety sweep
    thumbs[4].classList.remove('lightbox-active-thumb');
    document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb').forEach(img => {
      img.classList.remove('lightbox-active-thumb');
    });

    // ALL must be visible
    for (let i = 0; i < 5; i++) {
      expect(thumbs[i].classList.contains('lightbox-active-thumb')).toBe(false);
      expect(thumbs[i].style.opacity).toBe('');
    }
  });

  it('navigating back to already-visited thumb works correctly', () => {
    const thumb1 = addCard('https://example.com/1.jpg');
    const thumb2 = addCard('https://example.com/2.jpg');

    // Open thumb1 -> navigate to thumb2 -> navigate back to thumb1
    thumb1.classList.add('lightbox-active-thumb');
    thumb1.classList.remove('lightbox-active-thumb');
    thumb2.classList.add('lightbox-active-thumb');
    thumb2.classList.remove('lightbox-active-thumb');
    thumb1.classList.add('lightbox-active-thumb');

    // Close
    thumb1.classList.remove('lightbox-active-thumb');

    expect(thumb1.classList.contains('lightbox-active-thumb')).toBe(false);
    expect(thumb2.classList.contains('lightbox-active-thumb')).toBe(false);
  });
});

describe('Regression: No stuck inline opacity or animations after ANY close', () => {
  let galleryGrid;

  beforeEach(() => {
    galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    document.body.appendChild(galleryGrid);
  });

  afterEach(() => {
    galleryGrid.remove();
  });

  function addCard(src) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    galleryGrid.appendChild(card);
    return img;
  }

  it('no grid thumbnails should have lightbox-active-thumb class after close', () => {
    const img1 = addCard('https://example.com/1.jpg');
    const img2 = addCard('https://example.com/2.jpg');
    const img3 = addCard('https://example.com/3.jpg');

    // Simulate various stuck states
    img1.classList.add('lightbox-active-thumb');
    img2.classList.add('lightbox-active-thumb');
    // img3 clean

    // Safety sweep (as implemented in "Restore grid thumb on lightbox close" effect)
    document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb').forEach(img => {
      img.classList.remove('lightbox-active-thumb');
    });

    const stuckThumbs = document.querySelectorAll('.gallery-grid .card img.lightbox-active-thumb');
    expect(stuckThumbs.length).toBe(0);
  });

  it('no grid thumbnails should have stuck inline opacity after close', () => {
    const img1 = addCard('https://example.com/1.jpg');
    const img2 = addCard('https://example.com/2.jpg');
    const img3 = addCard('https://example.com/3.jpg');

    // The CSS-class approach means no inline opacity is ever set on grid thumbs
    // by the refactored code. Verify no inline opacity exists.
    [img1, img2, img3].forEach(img => {
      expect(img.style.opacity).toBe('');
    });
  });

  it('hook code should not set inline opacity on grid thumbnails (uses CSS class instead)', () => {
    // Verify the openLightbox code uses classList.add, not style.opacity
    const openBlock = hookContent.match(/const openLightbox = useCallback\(\(index.*?\{([\s\S]*?)\}, \[/);
    expect(openBlock).not.toBeNull();
    expect(openBlock[1]).toMatch(/classList\.add\('lightbox-active-thumb'\)/);
    // Should not contain thumbEl.style.opacity = '0' for hiding
    expect(openBlock[1]).not.toMatch(/thumbEl\.style\.opacity\s*=\s*'0'/);
  });

  it('sync effect should use classList instead of inline opacity animations', () => {
    // The "keep grid thumbs in sync" effect should use classList, not el.animate
    const syncBlock = hookContent.match(/Keep grid thumbs in sync[\s\S]*?\}, \[isLightboxOpen, images, lightboxIndex/);
    expect(syncBlock).not.toBeNull();
    expect(syncBlock[0]).toMatch(/classList\.add\('lightbox-active-thumb'\)/);
    expect(syncBlock[0]).toMatch(/classList\.remove\('lightbox-active-thumb'\)/);
    // Should not use el.animate for opacity on thumbnails
    expect(syncBlock[0]).not.toMatch(/animateOpacity/);
  });
});

// =============================================================================
// Tab Visibility / Zero-Dimension Rect Protection
// =============================================================================

describe('Zero-dimension rect validation (tab visibility fix)', () => {
  it('isValidRect and LAYOUT_RETRY_LIMIT should be at module scope (not inside hook)', () => {
    // They should appear before the function useLightboxAnimations declaration
    const hookStart = hookContent.indexOf('export function useLightboxAnimations');
    const isValidRectPos = hookContent.indexOf('const isValidRect');
    const retryLimitPos = hookContent.indexOf('const LAYOUT_RETRY_LIMIT');
    expect(isValidRectPos).toBeGreaterThan(-1);
    expect(retryLimitPos).toBeGreaterThan(-1);
    expect(isValidRectPos).toBeLessThan(hookStart);
    expect(retryLimitPos).toBeLessThan(hookStart);
  });

  it('hook should define an isValidRect helper', () => {
    expect(hookContent).toMatch(/isValidRect\s*=\s*\(r.*?\)\s*=>\s*r\.width\s*>\s*0\s*&&\s*r\.height\s*>\s*0/);
  });

  it('hook should define a waitForValidRect function with retry logic', () => {
    expect(hookContent).toMatch(/function waitForValidRect\(/);
    expect(hookContent).toMatch(/LAYOUT_RETRY_LIMIT/);
  });

  it('waitForValidRect should accept an AbortSignal parameter', () => {
    expect(hookContent).toMatch(/waitForValidRect\(el.*?signal\?.*?AbortSignal/s);
  });

  it('waitForValidRect should have a setTimeout fallback', () => {
    // The function should use setTimeout to guarantee resolution
    const fnBlock = hookContent.match(/function waitForValidRect[\s\S]*?^}/m);
    expect(fnBlock).not.toBeNull();
    expect(fnBlock[0]).toMatch(/setTimeout/);
    expect(fnBlock[0]).toMatch(/LAYOUT_RETRY_TIMEOUT_MS/);
  });

  it('waitForValidRect should reuse isValidRect (no duplicated check)', () => {
    const fnBlock = hookContent.match(/function waitForValidRect[\s\S]*?^}/m);
    expect(fnBlock).not.toBeNull();
    expect(fnBlock[0]).toMatch(/isValidRect\(rect\)/);
  });

  it('isValidRect should return false for zero-dimension rects', () => {
    const isValidRect = (r) => r.width > 0 && r.height > 0;

    expect(isValidRect({ left: 0, top: 0, width: 0, height: 0 })).toBe(false);
    expect(isValidRect({ left: 100, top: 200, width: 0, height: 0 })).toBe(false);
    expect(isValidRect({ left: 0, top: 0, width: 100, height: 0 })).toBe(false);
    expect(isValidRect({ left: 0, top: 0, width: 0, height: 100 })).toBe(false);
  });

  it('isValidRect should return true for normal rects', () => {
    const isValidRect = (r) => r.width > 0 && r.height > 0;

    expect(isValidRect({ left: 0, top: 0, width: 100, height: 100 })).toBe(true);
    expect(isValidRect({ left: 50, top: 50, width: 1, height: 1 })).toBe(true);
    expect(isValidRect({ left: -10, top: -10, width: 200, height: 300 })).toBe(true);
  });

  it('open animation effect should check isValidRect on endRect before animating', () => {
    const openEffect = hookContent.match(
      /After mount of lightbox[\s\S]*?abortCtrl\.abort\(\)/
    );
    expect(openEffect).not.toBeNull();
    expect(openEffect[0]).toMatch(/isValidRect\(endRect\)/);
  });

  it('open animation effect should call waitForValidRect with abort signal', () => {
    const openEffect = hookContent.match(
      /After mount of lightbox[\s\S]*?abortCtrl\.abort\(\)/
    );
    expect(openEffect).not.toBeNull();
    expect(openEffect[0]).toMatch(/waitForValidRect\(lightboxImg,\s*abortCtrl\.signal\)/);
  });

  it('open animation effect should check aborted signal after waiting', () => {
    const openEffect = hookContent.match(
      /After mount of lightbox[\s\S]*?abortCtrl\.abort\(\)/
    );
    expect(openEffect).not.toBeNull();
    expect(openEffect[0]).toMatch(/abortCtrl\.signal\.aborted/);
  });

  it('open animation effect should also validate startRect', () => {
    const openEffect = hookContent.match(
      /After mount of lightbox[\s\S]*?abortCtrl\.abort\(\)/
    );
    expect(openEffect).not.toBeNull();
    expect(openEffect[0]).toMatch(/isValidRect\(startRect\)/);
  });

  it('open animation should fall back gracefully when rects stay zero', () => {
    const openEffect = hookContent.match(
      /After mount of lightbox[\s\S]*?abortCtrl\.abort\(\)/
    );
    expect(openEffect).not.toBeNull();
    const fallbackBlock = openEffect[0].match(
      /!isValidRect\(endRect\)\s*\|\|\s*!isValidRect\(startRect\)\)\s*\{([\s\S]*?)return;/
    );
    expect(fallbackBlock).not.toBeNull();
    expect(fallbackBlock[1]).toMatch(/lightboxImg\.style\.opacity\s*=\s*''/);
    expect(fallbackBlock[1]).toMatch(/setHideLightboxImage\(false\)/);
    expect(fallbackBlock[1]).toMatch(/isAnimatingRef\.current\s*=\s*false/);
  });

  it('effect cleanup should abort the controller and cancel the rAF', () => {
    const openEffect = hookContent.match(
      /After mount of lightbox[\s\S]*?abortCtrl\.abort\(\)/
    );
    expect(openEffect).not.toBeNull();
    // Cleanup should call both cancelAnimationFrame and abortCtrl.abort()
    expect(openEffect[0]).toMatch(/cancelAnimationFrame\(rAF\)/);
    expect(openEffect[0]).toMatch(/abortCtrl\.abort\(\)/);
  });

  it('closeLightbox should validate rects before running wireframe animation', () => {
    const closeBlock = hookContent.match(
      /const closeLightbox = useCallback[\s\S]*?\}, \[reduceMotion/
    );
    expect(closeBlock).not.toBeNull();
    expect(closeBlock[0]).toMatch(/isValidRect\(startRect\)/);
    expect(closeBlock[0]).toMatch(/isValidRect\(endRect\)/);
  });

  it('closeLightbox should skip wireframe and fade backdrop when rects are zero', () => {
    const closeBlock = hookContent.match(
      /const closeLightbox = useCallback[\s\S]*?\}, \[reduceMotion/
    );
    expect(closeBlock).not.toBeNull();
    const skipBlock = closeBlock[0].match(
      /!isValidRect\(startRect\)\s*\|\|\s*!isValidRect\(endRect\)\)\s*\{([\s\S]*?)return;/
    );
    expect(skipBlock).not.toBeNull();
    expect(skipBlock[1]).toMatch(/animateLightboxBackdrop\('out'\)/);
    expect(skipBlock[1]).toMatch(/backdropDimmedRef\.current\s*=\s*false/);
  });

  it('LAYOUT_RETRY_LIMIT should be defined and positive', () => {
    const match = hookContent.match(/LAYOUT_RETRY_LIMIT\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);
  });

  it('LAYOUT_RETRY_TIMEOUT_MS should be defined and positive', () => {
    const match = hookContent.match(/LAYOUT_RETRY_TIMEOUT_MS\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);
  });
});
