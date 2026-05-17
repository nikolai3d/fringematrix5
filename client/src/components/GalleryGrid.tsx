import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
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

    /**
     * Cache of per-index callback refs so that the same function reference is
     * reused across renders for a given index. Without this, `setThumbRef(i)`
     * would produce a new closure on every render, causing React to call the
     * old ref with `null` and the new one with the element on every re-render —
     * unnecessary churn in `thumbMapRef`.
     */
    const refCallbackCacheRef = useRef<Map<number, (el: HTMLImageElement | null) => void>>(new Map());

    // Prune stale entries from both caches when images array shrinks (e.g. campaign switch).
    useEffect(() => {
      for (const key of refCallbackCacheRef.current.keys()) {
        if (key >= images.length) {
          refCallbackCacheRef.current.delete(key);
        }
      }
      for (const key of thumbMapRef.current.keys()) {
        if (key >= images.length) {
          thumbMapRef.current.delete(key);
        }
      }
    }, [images.length]);

    const setThumbRef = useCallback((index: number): (el: HTMLImageElement | null) => void => {
      let cb = refCallbackCacheRef.current.get(index);
      if (!cb) {
        cb = (el: HTMLImageElement | null) => {
          if (el) {
            thumbMapRef.current.set(index, el);
          } else {
            thumbMapRef.current.delete(index);
          }
        };
        refCallbackCacheRef.current.set(index, cb);
      }
      return cb;
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
