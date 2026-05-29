import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ImageData } from '../types/api';
import ImageCard from './ImageCard';
import { useGridWindow } from '../hooks/useGridWindow';

/** Number of leading cards rendered with eager/high-priority loading. */
export const EAGER_IMAGE_COUNT = 12;

/** Public API exposed to callers via a ref (useImperativeHandle). */
export interface GalleryGridHandle {
  /**
   * Returns the <img> element for the given image index, or null when the
   * element is not currently mounted (e.g. image is still loading, the
   * campaign changed, or the card is virtualized out of the current window).
   */
  getThumbElement: (index: number) => HTMLImageElement | null;
  /**
   * Scroll the given image index into the viewport so its card mounts. Used
   * by the lightbox-open-at-index flow to guarantee a target card (which may
   * be windowed out) is present and measurable before its thumbnail rect is
   * read for the zoom animation. No-op when windowing is inactive (everything
   * is already mounted) or the index is out of range.
   */
  scrollIndexIntoView: (index: number) => void;
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
  /**
   * Index whose card must stay mounted regardless of scroll position. Set to
   * the lightbox's current image index while the lightbox is open (and -1
   * otherwise) so paging next/prev to a windowed-out image still keeps that
   * thumbnail in the DOM for the close/zoom animation. Defaults to -1.
   */
  forceMountIndex?: number;
  /**
   * Token that changes whenever the thumbnail-size setting changes. Forwarded
   * to the windowing hook so it re-measures the column geometry (column count
   * and row height depend on --thumbnail-min-size). Optional; defaults to a
   * constant so non-campaign callers don't need to thread it.
   */
  thumbnailSizeKey?: unknown;
  /**
   * The current thumbnail rendered width in CSS pixels (the value App writes to
   * the `--thumbnail-min-size` grid variable). Forwarded to each ImageCard as
   * the `sizes` basis so the responsive `srcset` can request an appropriately
   * sized variant. Optional; when omitted, thumbnails fall back to the smallest
   * srcset candidate's width.
   */
  thumbnailCssPx?: number;
}

/**
 * Memoized, windowed gallery grid.
 *
 * App re-renders at 2.5 Hz while loadingDots ticks during image preload.
 * Wrapping this section in React.memo prevents the entire N-card VDOM diff
 * from running on every tick — React.memo's shallow prop compare means the
 * grid re-renders only when any prop changes identity. Keep `images` and
 * `onImageClick` stable across renders to retain the benefit; `ariaLabel`/
 * `testId` are typically string literals so they're effectively stable.
 *
 * Virtualization: only the cards whose rows intersect the viewport (plus an
 * overscan margin) are rendered; the remaining vertical space is reserved with
 * top/bottom spacer rows that span the full grid width so the layout, scrollbar
 * and scroll position match a fully-rendered grid. See useGridWindow. In
 * environments without real layout (jsdom unit tests) the hook reports a zero
 * width and the grid renders every card, preserving the non-windowed contract.
 *
 * Callers are responsible for rendering their own empty-state UI (the campaign
 * view renders "No Images In Campaign" and AuthorDetail renders "No images
 * attributed to this author yet."). This keeps the grid a pure list view,
 * reusable across both call sites.
 */
const GalleryGrid = React.memo(React.forwardRef<GalleryGridHandle, GalleryGridProps>(
  function GalleryGrid(
    { images, onImageClick, ariaLabel, testId, forceMountIndex = -1, thumbnailSizeKey, thumbnailCssPx },
    ref,
  ) {
    /** Tracks the <img> DOM element for each image index. */
    const thumbMapRef = useRef<Map<number, HTMLImageElement>>(new Map());
    /** The grid <section> element, used to measure column geometry. */
    const sectionRef = useRef<HTMLElement | null>(null);

    const win = useGridWindow(sectionRef, images.length, thumbnailSizeKey, forceMountIndex);

    useImperativeHandle(ref, () => ({
      getThumbElement(index: number): HTMLImageElement | null {
        return thumbMapRef.current.get(index) ?? null;
      },
      scrollIndexIntoView(index: number): void {
        if (index < 0 || index >= images.length) return;
        // Already mounted: scroll the live element into view if needed.
        const existing = thumbMapRef.current.get(index);
        if (existing) {
          try { existing.scrollIntoView({ block: 'nearest' }); } catch (_) { /* ignore */ }
          return;
        }
        // Windowed out: estimate the row's document Y from the grid geometry
        // and scroll the page so the row enters the viewport on the next
        // recompute, which mounts the card.
        const el = sectionRef.current;
        if (!el || !win.windowed || win.columns < 1) return;
        try {
          const rect = el.getBoundingClientRect();
          if (!(rect.width > 0)) return;
          const cs = getComputedStyle(el);
          const gap = parseFloat(cs.rowGap || cs.gap || '0') || 0;
          const cellWidth = (rect.width - (win.columns - 1) * gap) / win.columns;
          const rowHeight = cellWidth + gap;
          if (!(rowHeight > 0)) return;
          const row = Math.floor(index / win.columns);
          const scrollY = window.scrollY || window.pageYOffset || 0;
          const gridTop = rect.top + scrollY;
          // Center the target row in the viewport.
          const target = gridTop + row * rowHeight - Math.max(0, (window.innerHeight - rowHeight) / 2);
          window.scrollTo({ top: Math.max(0, target) });
        } catch (_) { /* ignore */ }
      },
    }), [images.length, win.windowed, win.columns]);

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

    // Build the rendered slice. When windowing is inactive (no layout, or a
    // list short enough not to bother) start/end cover the whole array, so this
    // renders every card exactly as before.
    const startIndex = win.windowed ? win.startIndex : 0;
    const endIndex = win.windowed ? win.endIndex : images.length - 1;

    const cards: React.ReactNode[] = [];
    for (let i = startIndex; i <= endIndex && i < images.length; i++) {
      const img = images[i];
      cards.push(
        <ImageCard
          key={`${img.src}-${i}`}
          image={img}
          imgRef={setThumbRef(i)}
          onClick={getClickCallback(i)}
          // Eagerly load the first ~2-3 rows (above the fold) so they start
          // downloading immediately; the rest stay native-lazy.
          eager={i < EAGER_IMAGE_COUNT}
          thumbnailCssPx={thumbnailCssPx}
        />,
      );
    }

    return (
      <section
        id="gallery"
        className="gallery-grid"
        aria-label={ariaLabel}
        data-testid={testId}
        ref={sectionRef}
      >
        {win.windowed && win.topPadPx > 0 && (
          // Spacer rows reserve the vertical space of the cards scrolled above
          // the window. `grid-column: 1 / -1` makes it span the full row so it
          // never consumes a card cell. aria-hidden + presentation keep it out
          // of the accessibility tree.
          <div
            className="gallery-grid-spacer gallery-grid-spacer--top"
            data-testid="gallery-grid-spacer-top"
            aria-hidden="true"
            role="presentation"
            style={{ gridColumn: '1 / -1', height: `${win.topPadPx}px` }}
          />
        )}
        {cards}
        {win.windowed && win.bottomPadPx > 0 && (
          <div
            className="gallery-grid-spacer gallery-grid-spacer--bottom"
            data-testid="gallery-grid-spacer-bottom"
            aria-hidden="true"
            role="presentation"
            style={{ gridColumn: '1 / -1', height: `${win.bottomPadPx}px` }}
          />
        )}
      </section>
    );
  },
));

export default GalleryGrid;
