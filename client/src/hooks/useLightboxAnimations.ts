import { useCallback, useEffect, useRef } from 'react';
import { escapeForAttributeSelector } from '../utils/escapeForAttributeSelector';

interface ImageData {
  fileName: string;
  src: string;
  originalSrc?: string;
  isLoading?: boolean;
  loadedSrc?: string | null;
}

interface UseLightboxAnimationsProps {
  images: ImageData[];
  isLightboxOpen: boolean;
  lightboxIndex: number;
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
    });
    const inner = document.createElement('div');
    inner.className = 'wireframe-rect-inner';
    Object.assign(inner.style, { position: 'absolute', inset: '0' });
    container.appendChild(inner);
    document.body.appendChild(container);
    wireframeElRef.current = container;
    return container;
  }, []);

  const runWireframeAnimation = useCallback(async (fromRect: Rect, toRect: Rect) => {
    try {
      const el = ensureWireframeElement();
      Object.assign(el.style, {
        left: `${fromRect.left}px`,
        top: `${fromRect.top}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
        borderRadius: '12px',
        display: 'block',
      });
      const duration = LIGHTBOX_ANIM_MS;
      const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
      const animation = el.animate(
        [
          { left: `${fromRect.left}px`, top: `${fromRect.top}px`, width: `${fromRect.width}px`, height: `${fromRect.height}px`, borderRadius: '12px', opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.85 },
          { left: `${toRect.left}px`, top: `${toRect.top}px`, width: `${toRect.width}px`, height: `${toRect.height}px`, borderRadius: '10px', opacity: 0, offset: 1 },
        ],
        { duration, easing, fill: 'forwards' }
      );
      await animation.finished;
      Object.assign(el.style, {
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
      });
      el.style.display = 'none';
    } catch (animErr) {
      // Best-effort: if animation API fails, hide the helper element
      const el = wireframeElRef.current;
      if (el) el.style.display = 'none';
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
    if (thumbEl) {
      const rect = thumbEl.getBoundingClientRect();
      pendingOpenStartRectRef.current = rect;
      setHideLightboxImage(true);
      lastOpenedThumbElRef.current = thumbEl;
      activeGridThumbRef.current = thumbEl;
      try {
        thumbEl.style.opacity = '1';
        const anim = thumbEl.animate(
          [
            { opacity: 1, offset: 0 },
            { opacity: 0, offset: 0.4 },
            { opacity: 0, offset: 1 },
          ],
          { duration: LIGHTBOX_ANIM_MS, easing: 'linear', fill: 'forwards' }
        );
        anim?.finished?.catch(() => {});
      } catch (err) {
        // Fall back to immediate style change if animation creation fails
        try { thumbEl.style.opacity = '0'; } catch (styleErr) { /* ignore style assignment failures */ }
      }
    }
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  }, [setHideLightboxImage, setIsLightboxOpen, setLightboxIndex]);

  const closeLightbox = useCallback(async () => {
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
      const escapedSrc = escapeForAttributeSelector(img.src);
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
      const duration = LIGHTBOX_ANIM_MS;
      const imgAnim = lightboxImg.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 0, offset: 0.4 },
          { opacity: 0, offset: 1 },
        ],
        { duration, easing: 'linear', fill: 'forwards' }
      );
      const backdropAnim = animateLightboxBackdrop('out');
      try { 
        if (thumbElement) thumbElement.style.opacity = '0'; 
      } catch (styleErr) { /* ignore style assignment failures */ }
      let thumbAnim;
      try {
        thumbAnim = thumbElement?.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: 0.6 },
            { opacity: 1, offset: 1 },
          ],
          { duration, easing: 'linear', fill: 'forwards' }
        );
      } catch (animErr) { /* ignore animation creation failures */ }
      await Promise.all([
        runWireframeAnimation(startRect, endRect),
        imgAnim.finished.catch(() => {}),
        (thumbAnim?.finished || Promise.resolve()).catch(() => {}),
        (backdropAnim?.finished || Promise.resolve()).catch(() => {}),
      ]);
      backdropDimmedRef.current = false;
    } finally {
      setIsLightboxOpen(false);
      setHideLightboxImage(false);
      const el = lastOpenedThumbElRef.current;
      if (el && document.body.contains(el)) {
        try { el.style.opacity = ''; } catch (styleErr) { /* ignore style assignment failures */ }
      }
      lastOpenedThumbElRef.current = null;
    }
  }, [images, lightboxIndex, animateLightboxBackdrop, runWireframeAnimation, setHideLightboxImage, setIsLightboxOpen]);

  // After mount of lightbox, animate wireframe and backdrop in
  useEffect(() => {
    if (!isLightboxOpen) return;
    const startRect = pendingOpenStartRectRef.current;
    const needBackdropIn = !backdropDimmedRef.current;
    if (!startRect) {
      if (needBackdropIn) {
        const anim = animateLightboxBackdrop('in');
        backdropDimmedRef.current = true;
        anim?.finished?.catch(() => {});
      }
      return;
    }
    const rAF = requestAnimationFrame(async () => {
      const lightboxImg = document.getElementById('lightbox-image');
      if (!lightboxImg) { setHideLightboxImage(false); pendingOpenStartRectRef.current = null; return; }
      const endRect = lightboxImg.getBoundingClientRect();
      lightboxImg.style.opacity = '0';
      const duration = LIGHTBOX_ANIM_MS;
      const imgAnim = lightboxImg.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.6 },
          { opacity: 1, offset: 1 },
        ],
        { duration, easing: 'linear', fill: 'forwards' }
      );
      let backdropAnim;
      if (needBackdropIn) {
        backdropAnim = animateLightboxBackdrop('in');
        backdropDimmedRef.current = true;
      }
      await Promise.all([
        runWireframeAnimation(startRect, endRect),
        imgAnim.finished.catch(() => {}),
        (backdropAnim?.finished || Promise.resolve()).catch(() => {}),
      ]);
      lightboxImg.style.opacity = '';
      setHideLightboxImage(false);
      pendingOpenStartRectRef.current = null;
    });
    return () => cancelAnimationFrame(rAF);
  }, [isLightboxOpen, lightboxIndex, animateLightboxBackdrop, runWireframeAnimation, setHideLightboxImage]);

  // Keep grid thumbs in sync during lightbox navigation
  useEffect(() => {
    if (!isLightboxOpen) return;
    const current = images[lightboxIndex];
    if (!current) return;
    const selector = `.gallery-grid .card img[src="${escapeForAttributeSelector(current.src)}"]`;
    const newThumb = document.querySelector(selector) as HTMLElement | null;

    const animateOpacity = (el: HTMLElement | null, to: number, ms: number) => {
      if (!el) return { finished: Promise.resolve() };
      try {
        const from = parseFloat(getComputedStyle(el).opacity || '1');
        return el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'linear', fill: 'forwards' });
      } catch (animErr) {
        // Best-effort fallback for environments without Web Animations API
        try { el.style.opacity = String(to); } catch (styleErr) { /* ignore style assignment failures */ }
        return { finished: Promise.resolve() };
      }
    };

    const prev = activeGridThumbRef.current;
    if (prev && prev !== newThumb && document.body.contains(prev)) {
      animateOpacity(prev, 1, 100);
    }
    if (newThumb) {
      animateOpacity(newThumb, 0, 100);
      activeGridThumbRef.current = newThumb;
    } else {
      activeGridThumbRef.current = null;
    }
  }, [isLightboxOpen, images, lightboxIndex]);

  // Restore grid thumb on lightbox close
  useEffect(() => {
    if (isLightboxOpen) return;
    const el = activeGridThumbRef.current;
    if (el && document.body.contains(el)) {
      try { el.style.opacity = ''; } catch (err) {
        const descriptor = el?.outerHTML?.substring(0, 100) || 'unknown element';
        console.error('Error while attempting to reset opacity on grid thumb. This may be due to a style assignment failure or another unexpected error.', err, descriptor);
      }
    }
    activeGridThumbRef.current = null;
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

  return { openLightbox, closeLightbox, pendingOpenStartRectRef };
}


