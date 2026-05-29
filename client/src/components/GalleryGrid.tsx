import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ImageData } from '../types/api';
import ImageCard from './ImageCard';

/** Number of leading cards rendered with eager/high-priority loading. */
export const EAGER_IMAGE_COUNT = 12;

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
  /** Stable callback — receives the image index and the thumbnail element */
  onImageClick: (index: number, thumbEl: HTMLImageElement) => void;
  /**
   * Optional ARIA label for the underlying <section>. Defaults to nothing
   * (the campaign gallery doesn't need one because it has an h1 above it).
   * Author detail provides a per-author label.
   */
  ariaLabel?: string;
  /**
   * Optional data-testid for the underlying <section>. Lets callers tag the
   * grid for tests (e.g. the author-detail grid uses `author-images-grid`).
   */
  testId?: string;
}

/**
 * Memoized gallery grid.
 *
 * App re-renders at 2.5 Hz while loadingDots ticks during image preload.
 * Wrapping this section in React.memo prevents the entire N-card VDOM diff
 * from running on every tick — React.memo's shallow prop compare means the
 * grid re-renders only when any prop (images, onImageClick, ariaLabel,
 * testId) changes identity. Keep `images` and `onImageClick` stable across
 * renders to retain the benefit; `ariaLabel`/`testId` are typically string
 * literals so they're effectively stable.
 *
 * Callers are responsible for rendering their own empty-state UI (the
 * campaign view renders "No Images In Campaign" and AuthorDetail renders
 * "No images attributed to this author yet."). This keeps the grid a pure
 * list view, reusable across both call sites.
 */
const GalleryGrid = React.memo(React.forwardRef<GalleryGridHandle, GalleryGridProps>(
  function GalleryGrid({ images, onImageClick, ariaLabel, testId }, ref) {
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

    return (
      <section
        id="gallery"
        className="gallery-grid"
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {images.map((img, i) => (
          <ImageCard
            key={`${img.src}-${i}`}
            image={img}
            imgRef={setThumbRef(i)}
            onClick={getClickCallback(i)}
            // Eagerly load the first ~2-3 rows (above the fold) so they start
            // downloading immediately; the rest stay native-lazy.
            eager={i < EAGER_IMAGE_COUNT}
          />
        ))}
      </section>
    );
  }
));

export default GalleryGrid;
