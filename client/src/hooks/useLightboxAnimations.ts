import { useCallback, useEffect, useRef } from 'react';
import { escapeForAttributeSelector } from '../utils/escapeForAttributeSelector';
import { LIGHTBOX_SIDEBAR_ANIMATION } from '../config/lightbox';
import type { ImageData } from '../types/api';

interface UseLightboxAnimationsProps {
  images: ImageData[];
  isLightboxOpen: boolean;
  lightboxIndex: number;
  reduceMotion: boolean;
  setLightboxIndex: (index: number) => void;
  setIsLightboxOpen: (open: boolean) => void;
  setHideLightboxImage: (hide: boolean) => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Number of extra requestAnimationFrame retries when getBoundingClientRect
 * returns zero-dimension rects (e.g. after a tab visibility change where the
 * browser has evicted decoded image data).
 */
const LAYOUT_RETRY_LIMIT = 3;

/** Maximum milliseconds to wait for a valid rect before giving up. */
const LAYOUT_RETRY_TIMEOUT_MS = 500;

/** Returns true when both width and height are greater than zero. */
const isValidRect = (r: Rect) => r.width > 0 && r.height > 0;

/**
 * Wait up to LAYOUT_RETRY_LIMIT animation frames (or LAYOUT_RETRY_TIMEOUT_MS,
 * whichever comes first) for the element to report non-zero dimensions.
 * After tab visibility changes the browser may need extra frames to decode
 * images and finish layout.  Accepts an AbortSignal so callers can cancel
 * early (e.g. when the effect cleanup runs).
 */
function waitForValidRect(el: HTMLElement, signal?: AbortSignal): Promise<DOMRect> {
  return new Promise(resolve => {
    let remaining = LAYOUT_RETRY_LIMIT;

    const settle = (rect: DOMRect) => {
      clearTimeout(timer);
      resolve(rect);
    };

    // Time-based fallback: resolve with whatever rect we have if rAF retries
    // stall (e.g. tab is still background-throttled).
    const timer = setTimeout(() => {
      remaining = 0; // force next check to resolve
      settle(el.getBoundingClientRect());
    }, LAYOUT_RETRY_TIMEOUT_MS);

    const check = () => {
      if (signal?.aborted) { settle(el.getBoundingClientRect()); return; }
      const rect = el.getBoundingClientRect();
      if (isValidRect(rect) || remaining <= 0) {
        settle(rect);
      } else {
        remaining--;
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  });
}

export function useLightboxAnimations({
  images,
  isLightboxOpen,
  lightboxIndex,
  reduceMotion,
  setLightboxIndex,
  setIsLightboxOpen,
  setHideLightboxImage,
}: UseLightboxAnimationsProps) {
  
  /**
   * Ref to the wireframe DOM element used for animating transitions between thumbnail and lightbox.
   * Created and appended to the DOM as needed, and removed/hid after animation completes.
   */
  const wireframeElRef = useRef<HTMLDivElement | null>(null);
  /**
   * Ref to store the starting rectangle for the pending open animation.
   * Set when opening the lightbox, used to animate from thumbnail to lightbox.
   */
  const pendingOpenStartRectRef = useRef<Rect | null>(null);
  /**
   * Ref to store the image src for the pending open animation.
   * Used to display the actual image inside the wireframe during zoom.
   */
  const pendingOpenImgSrcRef = useRef<string | null>(null);
  /**
   * Ref to track whether an open/close animation is currently in progress.
   * Used to prevent clicks from interrupting animations.
   */
  const isAnimatingRef = useRef<boolean>(false);
  /**
   * Ref to the last thumbnail element that was opened in the lightbox.
   * Used to coordinate animation and state between grid and lightbox.
   */
  const lastOpenedThumbElRef = useRef<HTMLElement | null>(null);
  /**
   * Ref to the currently active grid thumbnail element.
   * Used for focus management and animation coordination.
   */
  const activeGridThumbRef = useRef<HTMLElement | null>(null);
  /**
   * Ref to track whether the lightbox backdrop is currently dimmed.
   * Used to prevent redundant backdrop animations.
   */
  const backdropDimmedRef = useRef<boolean>(false);
  /**
   * Tracks whether the sidebar line→expand fade-in animation has already
   * played for the current open session. The post-mount effect re-runs
   * on every lightboxIndex change (PREVIOUS/NEXT, arrow keys, swipe);
   * without this guard the sidebar would replay its enter animation on
   * every navigation, producing a flicker. Reset on close / open.
   */
  const sidebarEnteredRef = useRef<boolean>(false);
  /**
   * Generation counter to prevent stale closeLightbox finally blocks from
   * clearing lastOpenedThumbElRef when a new openLightbox call has already
   * reassigned it during the close animation's await.
   */
  const openGenerationRef = useRef<number>(0);

  const LIGHTBOX_ANIM_MS = 360;
  // 0.86 was chosen to provide a strong dimming effect for the backdrop,
  // while still allowing some visibility of the underlying content for context.
  const LIGHTBOX_BACKDROP_OPACITY = 0.86;
  const LIGHTBOX_BACKDROP_EASING_IN = 'cubic-bezier(0, 0, 0.2, 1)';
  const LIGHTBOX_BACKDROP_EASING_OUT = 'cubic-bezier(0.4, 0, 1, 1)';

  const ensureWireframeElement = useCallback(() => {
    if (wireframeElRef.current && document.body.contains(wireframeElRef.current)) return wireframeElRef.current;
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
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
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
    wireframeElRef.current = container;
    return container;
  }, []);

  const runWireframeAnimation = useCallback(async (fromRect: Rect, toRect: Rect, imgSrc?: string, direction: 'open' | 'close' = 'open') => {
    let fitSwitchTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const el = ensureWireframeElement();
      const img = el.querySelector('.wireframe-rect-img') as HTMLImageElement | null;
      if (img && imgSrc) {
        img.src = imgSrc;
        img.style.display = 'block';
        // Start with cover for thumbnail-like appearance, end with contain for lightbox
        img.style.objectFit = direction === 'open' ? 'cover' : 'contain';
      } else if (img) {
        img.style.display = 'none';
      }
      Object.assign(el.style, {
        left: `${fromRect.left}px`,
        top: `${fromRect.top}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
        borderRadius: '12px',
        display: 'block',
        opacity: '1',
      });
      const duration = LIGHTBOX_ANIM_MS;
      const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

      // Switch object-fit partway through animation for a smooth visual transition
      fitSwitchTimeout = setTimeout(() => {
        if (img) img.style.objectFit = direction === 'open' ? 'contain' : 'cover';
      }, duration * 0.35);

      // Keep opacity at 1 throughout so the image stays fully visible during zoom.
      // The wireframe is hidden via display:none after animation completes.
      const animation = el.animate(
        [
          { left: `${fromRect.left}px`, top: `${fromRect.top}px`, width: `${fromRect.width}px`, height: `${fromRect.height}px`, borderRadius: '12px', offset: 0 },
          { left: `${toRect.left}px`, top: `${toRect.top}px`, width: `${toRect.width}px`, height: `${toRect.height}px`, borderRadius: '10px', offset: 1 },
        ],
        { duration, easing, fill: 'forwards' }
      );
      await animation.finished;
      clearTimeout(fitSwitchTimeout);
      Object.assign(el.style, {
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
      });
      el.style.display = 'none';
      if (img) img.style.display = 'none';
    } catch (animErr) {
      // Best-effort: if animation API fails or animation is cancelled, hide the helper element
      if (fitSwitchTimeout !== undefined) clearTimeout(fitSwitchTimeout);
      const el = wireframeElRef.current;
      if (el) el.style.display = 'none';
      const img = el?.querySelector('.wireframe-rect-img') as HTMLImageElement | null;
      if (img) img.style.display = 'none';
    }
  }, [ensureWireframeElement]);

  /**
   * Animate the IMAGE DETAILS sidebar on lightbox open/close.
   *
   * Enter: starts as a thin horizontal line (clipped to the vertical midline),
   * blinks `lineBlinkCount` times at `lineBlinkIntervalMs`, holds for
   * `lineHoldMs`, then expands to full size while content fades in.
   *
   * Exit: reverse — content fades out, sidebar collapses back to the
   * midline, then the line fades out.
   *
   * Returns a Promise that resolves when the animation completes (or
   * immediately if WAAPI is unavailable / sidebar is not in the DOM, or any
   * reduce-motion/reduce-effects mode is active).
   */
  const animateLightboxSidebar = useCallback(async (direction: 'in' | 'out'): Promise<void> => {
    // Defense-in-depth: openLightbox/closeLightbox already short-circuit when
    // reduceMotion is true. This belt-and-suspenders check also bails when
    // the user has toggled reduce-motion / reduce-effects via the in-app
    // settings, or has prefers-reduced-motion: reduce at the OS level. WAAPI
    // animations ignore CSS animation-duration overrides, so we must guard
    // here in JS.
    if (reduceMotion) return;
    try {
      const root = document.documentElement;
      if (root.classList.contains('reduce-motion') || root.classList.contains('reduce-effects')) return;
      if (typeof window !== 'undefined' && window.matchMedia) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      }
    } catch (_) { /* ignore — proceed with animation */ }

    const sidebar = document.querySelector('.lightbox-details') as HTMLElement | null;
    if (!sidebar) return;
    const content = sidebar.querySelectorAll<HTMLElement>(':scope > *');
    const cfg = LIGHTBOX_SIDEBAR_ANIMATION;

    // Collapsed: only the vertical midline strip is visible. Expanded: the
    // whole panel is visible.
    const COLLAPSED_CLIP = 'inset(calc(50% - 1px) 0 calc(50% - 1px) 0)';
    const EXPANDED_CLIP = 'inset(0 0 0 0)';

    try {
      if (direction === 'in') {
        const enterDuration = cfg.enterDurationMs;
        const expandDuration = Math.max(0, enterDuration - cfg.lineHoldMs);

        // Phase 0: paint the line state immediately so the panel is never
        // shown briefly at full size before the animation starts.
        sidebar.style.clipPath = COLLAPSED_CLIP;
        sidebar.style.opacity = '1';
        content.forEach(el => { el.style.opacity = '0'; });

        // Phase 1: blink the line. Each blink is one full opacity cycle
        // (1 → 0 → 1) spread over 2 * blinkInterval. If lineBlinkCount is 0
        // the line is held at opacity 1.
        const blinkFrames: Keyframe[] = [];
        const totalBlinkSteps = Math.max(0, cfg.lineBlinkCount) * 2;
        if (totalBlinkSteps > 0) {
          for (let i = 0; i <= totalBlinkSteps; i++) {
            blinkFrames.push({ opacity: i % 2 === 0 ? 1 : 0, offset: i / totalBlinkSteps });
          }
          const blinkDuration = Math.min(cfg.lineHoldMs, totalBlinkSteps * cfg.lineBlinkIntervalMs);
          const blink = sidebar.animate(blinkFrames, { duration: blinkDuration, fill: 'forwards' });
          await blink.finished.catch(() => {});
        } else if (cfg.lineHoldMs > 0) {
          await new Promise(resolve => setTimeout(resolve, cfg.lineHoldMs));
        }

        // Phase 2: expand the clip-path from midline to full.
        sidebar.style.opacity = '1';
        const expand = sidebar.animate(
          [
            { clipPath: COLLAPSED_CLIP, offset: 0 },
            { clipPath: EXPANDED_CLIP, offset: 1 },
          ],
          { duration: expandDuration, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
        );

        // Phase 3: fade in content. Starts at contentFadeInDelayMs relative to
        // the entire enter sequence (which started with phase 1).
        const contentDelay = Math.max(0, cfg.contentFadeInDelayMs - cfg.lineHoldMs);
        const contentDuration = Math.max(80, enterDuration - cfg.contentFadeInDelayMs);
        content.forEach(el => {
          el.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            { duration: contentDuration, delay: contentDelay, easing: 'ease-out', fill: 'forwards' },
          );
        });

        await expand.finished.catch(() => {});
        // Settle: clear inline overrides so reduce-effects toggles work later.
        sidebar.style.clipPath = '';
        sidebar.style.opacity = '';
        content.forEach(el => { el.style.opacity = ''; });
      } else {
        const exitDuration = cfg.exitDurationMs;
        const contentFade = Math.min(exitDuration * 0.45, 160);
        const collapseDelay = contentFade;

        // Phase A: fade content out fast.
        const fadeOuts = Array.from(content).map(el =>
          el.animate(
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: contentFade, easing: 'ease-in', fill: 'forwards' },
          ),
        );

        // Phase B: collapse clip-path to midline.
        const collapse = sidebar.animate(
          [
            { clipPath: EXPANDED_CLIP, offset: 0 },
            { clipPath: EXPANDED_CLIP, offset: collapseDelay / exitDuration },
            { clipPath: COLLAPSED_CLIP, offset: 1 },
          ],
          { duration: exitDuration, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
        );

        // Phase C: fade the line itself out at the tail.
        const lineFade = sidebar.animate(
          [
            { opacity: 1, offset: 0 },
            { opacity: 1, offset: Math.max(0, 1 - 0.15) },
            { opacity: 0, offset: 1 },
          ],
          { duration: exitDuration, fill: 'forwards' },
        );

        await Promise.all([
          ...fadeOuts.map(a => a.finished.catch(() => {})),
          collapse.finished.catch(() => {}),
          lineFade.finished.catch(() => {}),
        ]);
      }
    } catch (_) {
      // Best-effort: clear inline styles if WAAPI threw.
      try {
        sidebar.style.clipPath = '';
        sidebar.style.opacity = '';
        content.forEach(el => { el.style.opacity = ''; });
      } catch (__) { /* ignore */ }
    }
  }, [reduceMotion]);

  const animateLightboxBackdrop = useCallback((direction: 'in' | 'out') => {
    const el = document.getElementById('lightbox');
    if (!el) return { finished: Promise.resolve() };
    try {
      const from = direction === 'in' ? 'rgba(0,0,0,0)' : `rgba(0,0,0,${LIGHTBOX_BACKDROP_OPACITY})`;
      const to = direction === 'in' ? `rgba(0,0,0,${LIGHTBOX_BACKDROP_OPACITY})` : 'rgba(0,0,0,0)';
      const easing = direction === 'in' ? LIGHTBOX_BACKDROP_EASING_IN : LIGHTBOX_BACKDROP_EASING_OUT;
      el.style.backgroundColor = from;
      return el.animate(
        [{ backgroundColor: from }, { backgroundColor: to }],
        { duration: LIGHTBOX_ANIM_MS, easing, fill: 'forwards' }
      );
    } catch (err) {
      // Best-effort fallback if Web Animations API is unavailable
      try {
        const fallbackColor = direction === 'in'
          ? `rgba(0,0,0,${LIGHTBOX_BACKDROP_OPACITY})`
          : 'rgba(0,0,0,0)';
        el.style.backgroundColor = fallbackColor;
      } catch (styleErr) { /* ignore style assignment failures */ }
      return { finished: Promise.resolve() };
    }
  }, []);

  const openLightbox = useCallback((index: number, thumbEl?: HTMLElement) => {
    openGenerationRef.current++;
    // Reset sidebar-entered flag so the very first post-mount effect run
    // for this open session fires the line→expand animation; subsequent
    // runs (lightboxIndex changes from PREVIOUS/NEXT/arrow keys/swipe)
    // skip it to avoid flicker.
    sidebarEnteredRef.current = false;
    if (reduceMotion) {
      // Skip all animations - lightbox just appears instantly
      if (thumbEl) {
        lastOpenedThumbElRef.current = thumbEl;
        activeGridThumbRef.current = thumbEl;
        try { thumbEl.classList.add('lightbox-active-thumb'); } catch (_) { /* ignore */ }
      }
      setLightboxIndex(index);
      setIsLightboxOpen(true);
      setHideLightboxImage(false);
      isAnimatingRef.current = false;
      return;
    }
    isAnimatingRef.current = true;
    if (thumbEl) {
      const rect = thumbEl.getBoundingClientRect();
      pendingOpenStartRectRef.current = rect;
      setHideLightboxImage(true);
      lastOpenedThumbElRef.current = thumbEl;
      activeGridThumbRef.current = thumbEl;
      // Store the image src for wireframe animation
      const thumbImg = thumbEl.tagName === 'IMG' ? thumbEl as HTMLImageElement : thumbEl.querySelector('img');
      if (thumbImg) {
        pendingOpenImgSrcRef.current = thumbImg.src;
      } else {
        pendingOpenImgSrcRef.current = null;
      }
      try { thumbEl.classList.add('lightbox-active-thumb'); } catch (_) { /* ignore */ }
    }
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  }, [reduceMotion, setHideLightboxImage, setIsLightboxOpen, setLightboxIndex]);

  const closeLightbox = useCallback(async () => {
    const closeGeneration = openGenerationRef.current;
    // Defense-in-depth: openLightbox is responsible for resetting the
    // sidebar-entered flag on the next open, but clear it on close too
    // so any abnormal re-entry path (e.g. open without going through
    // openLightbox) still gets a clean enter animation.
    sidebarEnteredRef.current = false;
    if (reduceMotion) {
      // Skip all animations - lightbox just disappears instantly
      backdropDimmedRef.current = false;
      setIsLightboxOpen(false);
      setHideLightboxImage(false);
      isAnimatingRef.current = false;
      // Remove active-thumb class from tracked elements
      const el = lastOpenedThumbElRef.current;
      if (el && document.body.contains(el)) {
        try { el.classList.remove('lightbox-active-thumb'); } catch (_) { /* ignore */ }
      }
      const active = activeGridThumbRef.current;
      if (active && active !== el && document.body.contains(active)) {
        try { active.classList.remove('lightbox-active-thumb'); } catch (_) { /* ignore */ }
      }
      if (closeGeneration === openGenerationRef.current) {
        lastOpenedThumbElRef.current = null;
      }
      return;
    }
    isAnimatingRef.current = true;
    try {
      const img = images[lightboxIndex];
      const lightboxImg = document.getElementById('lightbox-image');
      if (!img || !lightboxImg) {
        const backdropAnim = animateLightboxBackdrop('out');
        await (backdropAnim?.finished || Promise.resolve()).catch(() => {});
        backdropDimmedRef.current = false;
        setIsLightboxOpen(false);
        return;
      }
      const startRect = lightboxImg.getBoundingClientRect();
      const escapedSrc = escapeForAttributeSelector(img.src || '');
      let thumbElement = document.querySelector(`.gallery-grid .card img[src="${escapedSrc}"]`) as HTMLElement | null;
      if (!thumbElement && activeGridThumbRef.current && document.body.contains(activeGridThumbRef.current)) {
        thumbElement = activeGridThumbRef.current;
      }
      if (!thumbElement && lastOpenedThumbElRef.current && document.body.contains(lastOpenedThumbElRef.current)) {
        thumbElement = lastOpenedThumbElRef.current;
      }
      if (!thumbElement) {
        const backdropAnim = animateLightboxBackdrop('out');
        await Promise.all([
          (backdropAnim?.finished || Promise.resolve()).catch(() => {}),
          animateLightboxSidebar('out'),
        ]);
        backdropDimmedRef.current = false;
        setIsLightboxOpen(false);
        return;
      }
      const endRect = thumbElement.getBoundingClientRect();
      // If either rect has zero dimensions (e.g. after tab visibility change),
      // skip the wireframe animation and just close with a backdrop fade.
      if (!isValidRect(startRect) || !isValidRect(endRect)) {
        const backdropAnim = animateLightboxBackdrop('out');
        await Promise.all([
          (backdropAnim?.finished || Promise.resolve()).catch(() => {}),
          animateLightboxSidebar('out'),
        ]);
        backdropDimmedRef.current = false;
        return;
      }
      // Hide lightbox image immediately since wireframe image takes over
      lightboxImg.style.opacity = '0';
      const backdropAnim = animateLightboxBackdrop('out');
      // Keep thumb hidden during close animation via CSS class (already applied)
      await Promise.all([
        runWireframeAnimation(startRect, endRect, img.src || undefined, 'close'),
        (backdropAnim?.finished || Promise.resolve()).catch(() => {}),
        animateLightboxSidebar('out'),
      ]);
      backdropDimmedRef.current = false;
    } finally {
      setIsLightboxOpen(false);
      setHideLightboxImage(false);
      isAnimatingRef.current = false;
      // Remove lightbox-active-thumb class from tracked elements
      const el = lastOpenedThumbElRef.current;
      if (el && document.body.contains(el)) {
        try { el.classList.remove('lightbox-active-thumb'); } catch (_) { /* ignore */ }
      }
      const active = activeGridThumbRef.current;
      if (active && active !== el && document.body.contains(active)) {
        try { active.classList.remove('lightbox-active-thumb'); } catch (_) { /* ignore */ }
      }
      // Only clear the ref if no new open has happened during our await
      if (closeGeneration === openGenerationRef.current) {
        lastOpenedThumbElRef.current = null;
      }
    }
  }, [reduceMotion, images, lightboxIndex, animateLightboxBackdrop, runWireframeAnimation, animateLightboxSidebar, setHideLightboxImage, setIsLightboxOpen]);

  // After mount of lightbox, animate wireframe and backdrop in
  useEffect(() => {
    if (!isLightboxOpen) return;
    if (reduceMotion) {
      // No animation needed - lightbox is already visible
      backdropDimmedRef.current = true;
      pendingOpenStartRectRef.current = null;
      pendingOpenImgSrcRef.current = null;
      isAnimatingRef.current = false;
      return;
    }
    const startRect = pendingOpenStartRectRef.current;
    const imgSrc = pendingOpenImgSrcRef.current;
    const needBackdropIn = !backdropDimmedRef.current;
    if (!startRect) {
      // Open the sidebar even when there is no thumbnail rect to animate
      // from (e.g. lightbox opened via direct link / URL hash).
      // Only on the FIRST run of this effect per open session — see
      // sidebarEnteredRef comment.
      if (!sidebarEnteredRef.current) {
        sidebarEnteredRef.current = true;
        animateLightboxSidebar('in');
      }
      if (needBackdropIn) {
        const anim = animateLightboxBackdrop('in');
        backdropDimmedRef.current = true;
        anim?.finished?.then(() => { isAnimatingRef.current = false; }).catch(() => { isAnimatingRef.current = false; });
      } else {
        isAnimatingRef.current = false;
      }
      return;
    }
    // AbortController lets us cancel waitForValidRect retries when the
    // effect cleans up (e.g. lightbox closed before animation finishes).
    const abortCtrl = new AbortController();
    const rAF = requestAnimationFrame(async () => {
      const lightboxImg = document.getElementById('lightbox-image');
      if (!lightboxImg) { setHideLightboxImage(false); pendingOpenStartRectRef.current = null; pendingOpenImgSrcRef.current = null; isAnimatingRef.current = false; return; }
      let endRect = lightboxImg.getBoundingClientRect();
      // After tab visibility changes the browser may evict decoded image data,
      // causing getBoundingClientRect to report zero dimensions until layout
      // catches up. Wait a few frames for a valid rect before animating.
      if (!isValidRect(endRect)) {
        endRect = await waitForValidRect(lightboxImg, abortCtrl.signal);
      }
      // Bail out if the effect was cleaned up while we were waiting.
      if (abortCtrl.signal.aborted) return;
      // If dimensions are still zero (or thumbnail rect was zero), skip the
      // wireframe animation and just show the lightbox image directly.
      if (!isValidRect(endRect) || !isValidRect(startRect)) {
        if (needBackdropIn) {
          animateLightboxBackdrop('in');
          backdropDimmedRef.current = true;
        }
        if (!sidebarEnteredRef.current) {
          sidebarEnteredRef.current = true;
          animateLightboxSidebar('in');
        }
        lightboxImg.style.opacity = '';
        setHideLightboxImage(false);
        pendingOpenStartRectRef.current = null;
        pendingOpenImgSrcRef.current = null;
        isAnimatingRef.current = false;
        return;
      }
      // Keep lightbox image hidden during animation - wireframe image takes its place
      lightboxImg.style.opacity = '0';
      let backdropAnim;
      if (needBackdropIn) {
        backdropAnim = animateLightboxBackdrop('in');
        backdropDimmedRef.current = true;
      }
      const sidebarPromise = sidebarEnteredRef.current
        ? Promise.resolve()
        : (sidebarEnteredRef.current = true, animateLightboxSidebar('in'));
      await Promise.all([
        runWireframeAnimation(startRect, endRect, imgSrc || undefined, 'open'),
        (backdropAnim?.finished || Promise.resolve()).catch(() => {}),
        sidebarPromise,
      ]);
      // Bail out if the effect was cleaned up during the animation.
      if (abortCtrl.signal.aborted) return;
      lightboxImg.style.opacity = '';
      setHideLightboxImage(false);
      pendingOpenStartRectRef.current = null;
      pendingOpenImgSrcRef.current = null;
      isAnimatingRef.current = false;
    });
    return () => { cancelAnimationFrame(rAF); abortCtrl.abort(); };
  }, [isLightboxOpen, lightboxIndex, reduceMotion, animateLightboxBackdrop, runWireframeAnimation, animateLightboxSidebar, setHideLightboxImage]);

  // Keep grid thumbs in sync during lightbox navigation
  useEffect(() => {
    if (!isLightboxOpen) return;
    const current = images[lightboxIndex];
    if (!current) return;
    const selector = `.gallery-grid .card img[src="${escapeForAttributeSelector(current.src || '')}"]`;
    const newThumb = document.querySelector(selector) as HTMLElement | null;

    const prev = activeGridThumbRef.current;
    if (prev && prev !== newThumb && document.body.contains(prev)) {
      try { prev.classList.remove('lightbox-active-thumb'); } catch (_) { /* ignore */ }
    }
    if (newThumb) {
      try { newThumb.classList.add('lightbox-active-thumb'); } catch (_) { /* ignore */ }
      activeGridThumbRef.current = newThumb;
    } else {
      activeGridThumbRef.current = null;
    }
  }, [isLightboxOpen, images, lightboxIndex, reduceMotion]);

  // Restore grid thumb on lightbox close
  useEffect(() => {
    if (isLightboxOpen) return;
    const el = activeGridThumbRef.current;
    if (el && document.body.contains(el)) {
      try { el.classList.remove('lightbox-active-thumb'); } catch (_) { /* ignore */ }
    }
    activeGridThumbRef.current = null;
    // Safety sweep: ensure no grid thumbnails are stuck invisible due to
    // stale lightbox-active-thumb classes from interrupted interactions.
    try {
      document.querySelectorAll<HTMLElement>('.gallery-grid .card img.lightbox-active-thumb').forEach(img => {
        try { img.classList.remove('lightbox-active-thumb'); } catch (_) { /* ignore */ }
      });
    } catch (_) { /* ignore */ }
  }, [isLightboxOpen]);

  // Cleanup wireframe helper element on unmount to prevent leaks
  useEffect(() => {
    return () => {
      const el = wireframeElRef.current;
      if (!el) return;
      try {
        el.getAnimations?.().forEach(a => a.cancel());
      } catch (_) { /* ignore */ }
      try {
        el.remove();
      } catch (_) {
        try { el.parentNode?.removeChild?.(el); } catch (_) { /* ignore */ }
      }
      wireframeElRef.current = null;
    };
  }, []);

  return { openLightbox, closeLightbox, pendingOpenStartRectRef, isAnimatingRef };
}


