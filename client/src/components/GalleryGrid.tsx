import React, { useCallback, useImperativeHandle, useRef } from 'react';
import type { ImageData } from '../types/api';

/** Public API exposed to callers via a ref (useImperativeHandle). */
export interface GalleryGridHandle {
  /**
   * Returns the <img> element for the given image index, or null when the
   * element is not currently mounted (e.g. image is still loading or the
   * campaign changed).
   */
  getThumbElement: (index: number) => HTMLImageElement | null;
}

interface GalleryGridProps {
  images: ImageData[];
  /** Whether an active campaign is selected (used to show the empty state) */
  hasCampaign: boolean;
  /** Stable callback — receives the image index and the thumbnail element */
  onImageClick: (index: number, thumbEl: HTMLImageElement) => void;
}

/**
 * Memoized gallery grid.
 *
 * App re-renders at 2.5 Hz while loadingDots ticks during image preload.
 * Wrapping this section in React.memo prevents the entire N-card VDOM diff
 * from running on every tick — it only re-renders when images, hasCampaign,
 * or onImageClick actually change.
 */
const GalleryGrid = React.memo(React.forwardRef<GalleryGridHandle, GalleryGridProps>(
  function GalleryGrid({ images, hasCampaign, onImageClick }, ref) {
    /** Tracks the <img> DOM element for each image index. */
    const thumbMapRef = useRef<Map<number, HTMLImageElement>>(new Map());

    useImperativeHandle(ref, () => ({
      getThumbElement(index: number): HTMLImageElement | null {
        return thumbMapRef.current.get(index) ?? null;
      },
    }), []);

    /** Callback ref factory — registers or unregisters each <img> element. */
    const setThumbRef = useCallback((index: number) => (el: HTMLImageElement | null) => {
      if (el) {
        thumbMapRef.current.set(index, el);
      } else {
        thumbMapRef.current.delete(index);
      }
    }, []);

    const isEmpty = hasCampaign && images.length === 0;

    return (
      <section
        id="gallery"
        className={`gallery-grid${isEmpty ? ' empty' : ''}`}
        aria-live="polite"
      >
        {isEmpty ? (
          <div className="empty-state" role="status" aria-live="polite">
            <div className="empty-emoji" aria-hidden>🖼️</div>
            <div className="empty-title">No Images In Campaign</div>
            <div className="empty-desc">This campaign has no uploaded images yet.</div>
          </div>
        ) : (
          images.map((img, i) => (
            <div className="card" key={`${img.src}-${i}`}>
              {img.isLoading ? (
                <div className="image-placeholder">
                  <div className="placeholder-content">
                    <div className="placeholder-icon">📷</div>
                    <div className="placeholder-text">Loading...</div>
                  </div>
                </div>
              ) : (
                <img
                  ref={setThumbRef(i)}
                  src={img.loadedSrc || img.src || ''}
                  alt={img.fileName}
                  loading="lazy"
                  onClick={(e) => onImageClick(i, e.currentTarget)}
                />
              )}
              <div className="filename">{img.fileName}</div>
            </div>
          ))
        )}
      </section>
    );
  }
));

export default GalleryGrid;
