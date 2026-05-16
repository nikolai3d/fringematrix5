import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Campaign, ImageData } from '../types/api';
import LightboxDetails from './LightboxDetails';

/** Minimum horizontal travel (px) required for a touch to count as a swipe. */
const SWIPE_MIN_HORIZONTAL_PX = 50;
/** Maximum vertical drift (px) allowed before a gesture is treated as a scroll. */
const SWIPE_MAX_VERTICAL_PX = 75;
/** Maximum gesture duration (ms); longer presses are not counted as swipes. */
const SWIPE_MAX_DURATION_MS = 500;
/** Viewport breakpoint (px) below which the inline sidebar gives way to a drawer. */
const MOBILE_BREAKPOINT_PX = 768;

interface Props {
  images: ImageData[];
  lightboxIndex: number;
  isLightboxOpen: boolean;
  hideLightboxImage: boolean;
  activeCampaign: Campaign | null;
  setLightboxIndex: React.Dispatch<React.SetStateAction<number>>;
  closeLightbox: () => void;
  isAnimatingRef: MutableRefObject<boolean>;
}

export default function LightboxContainer({
  images,
  lightboxIndex,
  isLightboxOpen,
  hideLightboxImage,
  activeCampaign,
  setLightboxIndex,
  closeLightbox,
  isAnimatingRef,
}: Props) {
  const swipeRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const infoBtnRef = useRef<HTMLButtonElement | null>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState<boolean>(false);
  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const nextImage = useCallback((delta: number) => {
    setLightboxIndex((idx) => (images.length === 0 ? 0 : (idx + delta + images.length) % images.length));
  }, [images.length, setLightboxIndex]);

  const handleShare = useCallback(async () => {
    const img = images[lightboxIndex];
    if (!img || !img.src) return;
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('img', img.src);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fringe Matrix', text: img.fileName, url: shareUrl.toString() });
      } catch { /* user cancelled or share rejected */ }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl.toString());
        alert('Link copied to clipboard');
      } catch { /* clipboard permission denied or insecure context */ }
    }
  }, [images, lightboxIndex]);

  const handleLightboxClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Animation-in-progress clicks would otherwise interrupt the open/close transition.
    if (isAnimatingRef.current) return;

    const lightboxImage = document.getElementById('lightbox-image') as HTMLImageElement | null;
    if (!lightboxImage) return;

    const imageRect = lightboxImage.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;

    const isInsideImage = (
      clickX >= imageRect.left &&
      clickX <= imageRect.right &&
      clickY >= imageRect.top &&
      clickY <= imageRect.bottom
    );

    // The lightbox has several interactive regions besides the image
    // itself: the right-side details sidebar (or its mobile drawer),
    // the bottom nav toolbar, and the info button. Clicks anywhere in
    // those should NOT close the lightbox.
    const isInsideZone = (selector: string): boolean => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return clickX >= r.left && clickX <= r.right && clickY >= r.top && clickY <= r.bottom;
    };

    const isInToolbarArea = isInsideZone('.lightbox-nav-toolbar');
    const isInSidebarArea = isInsideZone('.lightbox-details');
    const isInInfoBtnArea = isInsideZone('.lightbox-info-btn');
    const isInDrawerArea = isInsideZone('.lightbox-details-drawer');

    if (!isInsideImage && !isInToolbarArea && !isInSidebarArea && !isInInfoBtnArea && !isInDrawerArea) {
      closeLightbox();
    }
  }, [closeLightbox, isAnimatingRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    swipeRef.current = { startX: e.clientX, startY: e.clientY, startTime: Date.now() };
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!swipeRef.current || e.pointerType === 'mouse') return;
    const dx = e.clientX - swipeRef.current.startX;
    const dy = e.clientY - swipeRef.current.startY;
    const dt = Date.now() - swipeRef.current.startTime;
    swipeRef.current = null;
    if (Math.abs(dx) > SWIPE_MIN_HORIZONTAL_PX && Math.abs(dy) < SWIPE_MAX_VERTICAL_PX && dt < SWIPE_MAX_DURATION_MS) {
      if (dx > 0) nextImage(-1);
      else nextImage(1);
    }
  }, [nextImage]);

  const closeDrawer = useCallback(() => {
    setIsDetailsDrawerOpen(false);
    // Return focus to the info toggle so keyboard users can re-open easily.
    requestAnimationFrame(() => { infoBtnRef.current?.focus(); });
  }, []);

  // Auto-close the drawer if the viewport widens past the mobile breakpoint
  // (e.g. device rotation): the inline sidebar will be visible again, so the
  // drawer is redundant and would obscure it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT_PX) setIsDetailsDrawerOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Reset drawer state when the lightbox itself closes.
  useEffect(() => {
    if (!isLightboxOpen) setIsDetailsDrawerOpen(false);
  }, [isLightboxOpen]);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (!isDetailsDrawerOpen) return;
    requestAnimationFrame(() => { drawerCloseBtnRef.current?.focus(); });
  }, [isDetailsDrawerOpen]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape closes the drawer first if it is open; otherwise the
        // whole lightbox. This matches the layered-modal pattern used
        // in the content modal.
        if (isDetailsDrawerOpen) {
          e.stopPropagation();
          closeDrawer();
          return;
        }
        closeLightbox();
      } else if (e.key === 'ArrowRight') nextImage(1);
      else if (e.key === 'ArrowLeft') nextImage(-1);
      else if (e.key === 'Tab') {
        // Trap focus inside the active modal layer (drawer if open,
        // otherwise the lightbox itself). Without this Tab eventually
        // escapes to the underlying gallery, which screen-reader users
        // perceive as "lost" focus.
        const container = isDetailsDrawerOpen ? drawerRef.current : lightboxRef.current;
        if (!container) return;
        const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
          .filter(el => !el.hidden && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !container.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isLightboxOpen, isDetailsDrawerOpen, closeDrawer, closeLightbox, nextImage]);

  // Move initial focus into the lightbox when it opens so keyboard users
  // start inside the modal. The close (✕) button is the conventional
  // landing spot for image lightboxes.
  useEffect(() => {
    if (!isLightboxOpen) return;
    requestAnimationFrame(() => { closeBtnRef.current?.focus(); });
  }, [isLightboxOpen]);

  if (!isLightboxOpen) return null;

  return (
    <div
      id="lightbox"
      className="lightbox"
      ref={lightboxRef}
      role="dialog"
      aria-modal={true}
      aria-label="Image viewer"
      aria-hidden={false}
      onClick={handleLightboxClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { swipeRef.current = null; }}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Visual HUD: aria-hidden because the same info lives in the
          screen-reader-only live region just below, which announces
          changes politely as the user navigates. */}
      <div className="lightbox-hud" aria-hidden={true}>
        FILE: {images[lightboxIndex]?.fileName || ''} {'// '}{lightboxIndex + 1} OF {images.length}
      </div>
      <div className="visually-hidden" aria-live="polite" aria-atomic={true}>
        {images[lightboxIndex]?.fileName
          ? `${images[lightboxIndex].fileName}, image ${lightboxIndex + 1} of ${images.length}`
          : ''}
      </div>
      <button
        className="lightbox-close"
        id="lightbox-close"
        ref={closeBtnRef}
        aria-label="Close"
        onClick={closeLightbox}
      >
        ✕
      </button>

      <button
        ref={infoBtnRef}
        type="button"
        className="lightbox-info-btn"
        aria-label={isDetailsDrawerOpen ? 'Hide image details' : 'Show image details'}
        aria-expanded={isDetailsDrawerOpen}
        onClick={(e) => { e.stopPropagation(); setIsDetailsDrawerOpen(v => !v); }}
      >
        <span aria-hidden={true}>i</span>
      </button>

      <div className="lightbox-layout">
        <div className="lightbox-stage">
          <div className="lightbox-image-wrap">
            <img
              id="lightbox-image"
              alt="Selected"
              src={images[lightboxIndex]?.src || ''}
              style={{ opacity: hideLightboxImage ? 0 : 1 }}
            />
          </div>

          <aside
            className="lightbox-details"
            aria-label="Image details"
          >
            <LightboxDetails campaign={activeCampaign} />
          </aside>
        </div>

        <div className="lightbox-nav-toolbar" role="toolbar" aria-label="Lightbox navigation">
          <button
            id="prev-btn"
            type="button"
            className="lightbox-nav-btn"
            aria-label="Previous image"
            onClick={(e) => { e.stopPropagation(); nextImage(-1); }}
          >
            <span className="lightbox-nav-btn-chevron" aria-hidden={true}>‹</span>
            <span className="lightbox-nav-btn-label">PREVIOUS</span>
          </button>
          <a
            id="download-btn"
            className="lightbox-nav-btn"
            href={images[lightboxIndex]?.src || '#'}
            download={images[lightboxIndex]?.fileName || ''}
            aria-label="Download image"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="lightbox-nav-btn-icon" aria-hidden={true} viewBox="0 0 24 24" width="16" height="16">
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" />
            </svg>
            <span className="lightbox-nav-btn-label">DOWNLOAD</span>
          </a>
          <button
            id="share-btn"
            type="button"
            className="lightbox-nav-btn"
            aria-label="Share image"
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
          >
            <svg className="lightbox-nav-btn-icon" aria-hidden={true} viewBox="0 0 24 24" width="16" height="16">
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M18 8a3 3 0 1 0-2.83-4M6 12a3 3 0 1 0 0 0m9 4a3 3 0 1 0 2.83 4M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
            <span className="lightbox-nav-btn-label">SHARE</span>
          </button>
          <button
            id="next-btn"
            type="button"
            className="lightbox-nav-btn lightbox-nav-btn--primary"
            aria-label="Next image"
            onClick={(e) => { e.stopPropagation(); nextImage(1); }}
          >
            <span className="lightbox-nav-btn-label">NEXT</span>
            <span className="lightbox-nav-btn-chevron" aria-hidden={true}>›</span>
          </button>
        </div>
      </div>

      {isDetailsDrawerOpen && (
        <div
          id="lightbox-details-drawer"
          className="lightbox-details-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal={true}
          aria-label="Image details"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={drawerCloseBtnRef}
            type="button"
            className="lightbox-details-drawer-close"
            aria-label="Close image details"
            onClick={(e) => { e.stopPropagation(); closeDrawer(); }}
          >
            ✕
          </button>
          <LightboxDetails campaign={activeCampaign} />
        </div>
      )}
    </div>
  );
}
