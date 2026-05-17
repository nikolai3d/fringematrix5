import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ImageData } from '../types/api';
import ImageCard from './ImageCard';

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

    /**
     * Cache of per-index click handlers so that the same function reference is
     * passed to each ImageCard across renders. This is what makes React.memo on
     * ImageCard effective — without stable references the memo check would fail
     * on every render.
     */
    const clickCallbackCacheRef = useRef<Map<number, (e: React.MouseEvent<HTMLImageElement>) => void>>(new Map());

    // Prune stale entries from all caches when images array shrinks (e.g. campaign switch).
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
      for (const key of clickCallbackCacheRef.current.keys()) {
        if (key >= images.length) {
          clickCallbackCacheRef.current.delete(key);
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

    /**
     * Returns a stable per-index click handler that forwards to the parent's
     * onImageClick. Because onImageClick may change identity (e.g. on re-render),
     * we capture it via a ref so the cached closure always calls the latest version
     * without itself needing to change.
     */
    const onImageClickRef = useRef(onImageClick);
    onImageClickRef.current = onImageClick;

    const getClickCallback = useCallback(
      (index: number): ((e: React.MouseEvent<HTMLImageElement>) => void) => {
        let cb = clickCallbackCacheRef.current.get(index);
        if (!cb) {
          cb = (e: React.MouseEvent<HTMLImageElement>) => {
            onImageClickRef.current(index, e.currentTarget);
          };
          clickCallbackCacheRef.current.set(index, cb);
        }
        return cb;
      },
      [],
    );

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
            <ImageCard
              key={`${img.src}-${i}`}
              image={img}
              imgRef={setThumbRef(i)}
              onClick={getClickCallback(i)}
            />
          ))
        )}
      </section>
    );
  }
));

export default GalleryGrid;
