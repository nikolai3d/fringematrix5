import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { ImageData } from '../types/api';

// Swipe thresholds tuned to feel responsive without firing on incidental drags.
const SWIPE_MIN_HORIZONTAL_PX = 50;
const SWIPE_MAX_VERTICAL_PX = 75;
const SWIPE_MAX_DURATION_MS = 500;

interface Props {
  images: ImageData[];
  lightboxIndex: number;
  isLightboxOpen: boolean;
  hideLightboxImage: boolean;
  setLightboxIndex: (updater: (idx: number) => number) => void;
  closeLightbox: () => void;
  isAnimatingRef: MutableRefObject<boolean>;
}

export default function LightboxContainer({
  images,
  lightboxIndex,
  isLightboxOpen,
  hideLightboxImage,
  setLightboxIndex,
  closeLightbox,
  isAnimatingRef,
}: Props) {
  const swipeRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);

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
      } catch {}
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl.toString());
        alert('Link copied to clipboard');
      } catch {
        // clipboard permission denied or insecure context — fail silently
      }
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

    const toolbarElement = document.querySelector('.lightbox-actions') as HTMLElement | null;
    let isInToolbarArea = false;
    if (toolbarElement) {
      const toolbarRect = toolbarElement.getBoundingClientRect();
      isInToolbarArea = (
        clickX >= toolbarRect.left &&
        clickX <= toolbarRect.right &&
        clickY >= toolbarRect.top &&
        clickY <= toolbarRect.bottom
      );
    }

    if (!isInsideImage && !isInToolbarArea) {
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
      <img
        id="lightbox-image"
        alt="Selected"
        src={images[lightboxIndex]?.src || ''}
        style={{ opacity: hideLightboxImage ? 0 : 1 }}
      />
      <div className="lightbox-actions">
        <button
          id="prev-btn"
          className="nav-btn"
          aria-label="Previous"
          onClick={(e) => { e.stopPropagation(); nextImage(-1); }}
        >
          ◀
        </button>
        <div className="spacer"></div>
        <a
          id="download-btn"
          className="action-btn"
          download
          href={images[lightboxIndex]?.src || '#'}
          onClick={(e) => e.stopPropagation()}
        >
          Download
        </a>
        <button
          id="share-btn"
          className="action-btn"
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
        >
          Share
        </button>
        <div className="spacer"></div>
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
  );
}
