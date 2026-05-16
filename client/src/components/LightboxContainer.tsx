import React, { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Campaign, ImageData } from '../types/api';
import LightboxDetails from './LightboxDetails';

/** Minimum horizontal travel (px) required for a touch to count as a swipe. */
const SWIPE_MIN_HORIZONTAL_PX = 50;
/** Maximum vertical drift (px) allowed before a gesture is treated as a scroll. */
const SWIPE_MAX_VERTICAL_PX = 75;
/** Maximum gesture duration (ms); longer presses are not counted as swipes. */
const SWIPE_MAX_DURATION_MS = 500;

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

  const nextImage = useCallback((delta: number) => {
    setLightboxIndex((idx) => (images.length === 0 ? 0 : (idx + delta + images.length) % images.length));
  }, [images.length, setLightboxIndex]);

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

    // The lightbox now has three interactive regions besides the image itself:
    // the right-side details sidebar, the bottom nav toolbar, and the side
    // ◀/▶ arrows overlay. Clicks anywhere in those should NOT close the
    // lightbox.
    const isInsideZone = (selector: string): boolean => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return clickX >= r.left && clickX <= r.right && clickY >= r.top && clickY <= r.bottom;
    };

    const isInToolbarArea = isInsideZone('.lightbox-nav-toolbar');
    const isInSidebarArea = isInsideZone('.lightbox-details');
    const isInSideArrowsArea = isInsideZone('.lightbox-side-arrows');

    if (!isInsideImage && !isInToolbarArea && !isInSidebarArea && !isInSideArrowsArea) {
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

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') nextImage(1);
      else if (e.key === 'ArrowLeft') nextImage(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isLightboxOpen, closeLightbox, nextImage]);

  if (!isLightboxOpen) return null;

  return (
    <div
      id="lightbox"
      className="lightbox"
      aria-hidden={false}
      onClick={handleLightboxClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { swipeRef.current = null; }}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="lightbox-hud" aria-hidden={true}>
        FILE: {images[lightboxIndex]?.fileName || ''} {'// '}{lightboxIndex + 1} OF {images.length}
      </div>
      <button
        className="lightbox-close"
        id="lightbox-close"
        aria-label="Close"
        onClick={closeLightbox}
      >
        ✕
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
            <div className="lightbox-side-arrows" aria-hidden={false}>
              <button
                id="prev-btn"
                className="nav-btn"
                aria-label="Previous"
                onClick={(e) => { e.stopPropagation(); nextImage(-1); }}
              >
                ◀
              </button>
              <button
                id="next-btn"
                className="nav-btn"
                aria-label="Next"
                onClick={(e) => { e.stopPropagation(); nextImage(1); }}
              >
                ▶
              </button>
            </div>
          </div>

          <aside
            className="lightbox-details"
            aria-label="Image details"
            aria-live="polite"
          >
            <LightboxDetails campaign={activeCampaign} />
          </aside>
        </div>

        <div className="lightbox-nav-toolbar" role="toolbar" aria-label="Lightbox navigation">
          <button
            type="button"
            className="lightbox-nav-btn"
            aria-label="Previous image"
            onClick={(e) => { e.stopPropagation(); nextImage(-1); }}
          >
            <span className="lightbox-nav-btn-chevron" aria-hidden={true}>‹</span>
            <span className="lightbox-nav-btn-label">PREVIOUS</span>
          </button>
          <button
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
    </div>
  );
}
