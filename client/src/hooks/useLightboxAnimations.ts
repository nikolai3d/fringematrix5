import { useCallback, useEffect, useRef } from 'react';
import { escapeForAttributeSelector } from '../utils/escapeForAttributeSelector';
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
   * Generation counter to prevent stale closeLightbox finally blocks from
   * clearing lastOpenedThumbElRef when a new openLightbox call has already
   * reassigned it during the close animation's await.
   */
  const openGenerationRef = useRef<number>(0);

  /**
   * Number of extra requestAnimationFrame retries when getBoundingClientRect
   * returns zero-dimension rects (e.g. after a tab visibility change where the
   * browser has evicted decoded image data).
   */
  const LAYOUT_RETRY_LIMIT = 3;

  const LIGHTBOX_ANIM_MS = 360;
  // 0.86 was chosen to provide a strong dimming effect for the backdrop,
  // while still allowing some visibility of the underlying content for context.
  const LIGHTBOX_BACKDROP_OPACITY = 0.86;
  const LIGHTBOX_BACKDROP_EASING_IN = 'cubic-bezier(0, 0, 0.2, 1)';
  const LIGHTBOX_BACKDROP_EASING_OUT = 'cubic-bezier(0.4, 0, 1, 1)';

  /** Returns true when both width and height are greater than zero. */
  const isValidRect = (r: Rect) => r.width > 0 && r.height > 0;

  /**
   * Wait up to LAYOUT_RETRY_LIMIT animation frames for the element to report
   * non-zero dimensions.  After tab visibility changes the browser may need
   * extra frames to decode images and finish layout.
   */
  const waitForValidRect = (el: HTMLElement): Promise<DOMRect> => {
    return new Promise(resolve => {
      let remaining = LAYOUT_RETRY_LIMIT;
      const check = () => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 || remaining <= 0) {
          resolve(rect);
        } else {
          remaining--;
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    });
  };

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
        await (backdropAnim?.finished || Promise.resolve()).catch(() => {});
        backdropDimmedRef.current = false;
        setIsLightboxOpen(false);
        return;
      }
      const endRect = thumbElement.getBoundingClientRect();
      // If either rect has zero dimensions (e.g. after tab visibility change),
      // skip the wireframe animation and just close with a backdrop fade.
      if (!isValidRect(startRect) || !isValidRect(endRect)) {
        const backdropAnim = animateLightboxBackdrop('out');
        await (backdropAnim?.finished || Promise.resolve()).catch(() => {});
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
  }, [reduceMotion, images, lightboxIndex, animateLightboxBackdrop, runWireframeAnimation, setHideLightboxImage, setIsLightboxOpen]);

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
      if (needBackdropIn) {
        const anim = animateLightboxBackdrop('in');
        backdropDimmedRef.current = true;
        anim?.finished?.then(() => { isAnimatingRef.current = false; }).catch(() => { isAnimatingRef.current = false; });
      } else {
        isAnimatingRef.current = false;
      }
      return;
    }
    const rAF = requestAnimationFrame(async () => {
      const lightboxImg = document.getElementById('lightbox-image');
      if (!lightboxImg) { setHideLightboxImage(false); pendingOpenStartRectRef.current = null; pendingOpenImgSrcRef.current = null; isAnimatingRef.current = false; return; }
      let endRect = lightboxImg.getBoundingClientRect();
      // After tab visibility changes the browser may evict decoded image data,
      // causing getBoundingClientRect to report zero dimensions until layout
      // catches up. Wait a few frames for a valid rect before animating.
      if (!isValidRect(endRect)) {
        endRect = await waitForValidRect(lightboxImg);
      }
      // If dimensions are still zero (or thumbnail rect was zero), skip the
      // wireframe animation and just show the lightbox image directly.
      if (!isValidRect(endRect) || !isValidRect(startRect)) {
        if (needBackdropIn) {
          animateLightboxBackdrop('in');
          backdropDimmedRef.current = true;
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
      await Promise.all([
        runWireframeAnimation(startRect, endRect, imgSrc || undefined, 'open'),
        (backdropAnim?.finished || Promise.resolve()).catch(() => {}),
      ]);
      lightboxImg.style.opacity = '';
      setHideLightboxImage(false);
      pendingOpenStartRectRef.current = null;
      pendingOpenImgSrcRef.current = null;
      isAnimatingRef.current = false;
    });
    return () => cancelAnimationFrame(rAF);
  }, [isLightboxOpen, lightboxIndex, reduceMotion, animateLightboxBackdrop, runWireframeAnimation, setHideLightboxImage]);

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


