import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Windowing (virtual scrolling) for the CSS auto-fill gallery grid.
 *
 * The gallery uses `grid-template-columns: repeat(auto-fill, minmax(var(--thumbnail-min-size), 1fr))`
 * so the column count is derived at render time from the rendered grid width and
 * the current `--thumbnail-min-size`. Rather than render an ImageCard for every
 * image (N DOM nodes scaling linearly with the campaign size), we render only
 * the rows that intersect the viewport (plus an overscan margin) and reserve the
 * remaining vertical space with top/bottom spacer rows so the scrollbar and
 * scroll position stay correct.
 *
 * The page itself is the scroll container (no overflow scroller wraps the grid),
 * so geometry is computed against `window.scrollY` / `window.innerHeight` and the
 * grid section's absolute document offset.
 *
 * Degradation: in environments without real layout (jsdom unit tests) the grid
 * reports a zero width and we fall back to rendering every card, so callers that
 * don't lay out the DOM see the full, non-windowed behaviour.
 */

/** Extra rows rendered above and below the viewport to avoid blank flashes while scrolling. */
const OVERSCAN_ROWS = 3;

export interface GridWindow {
  /** First image index that should be rendered (inclusive). */
  startIndex: number;
  /** Last image index that should be rendered (inclusive). */
  endIndex: number;
  /** Number of columns currently laid out (>= 1). */
  columns: number;
  /** Pixel height to reserve above the rendered window (top spacer). */
  topPadPx: number;
  /** Pixel height to reserve below the rendered window (bottom spacer). */
  bottomPadPx: number;
  /** True when windowing is active; false means "render everything" (no layout / tiny lists). */
  windowed: boolean;
}

interface Metrics {
  columns: number;
  rowHeightPx: number;
  /** Absolute document Y of the grid's content-box top. */
  gridTopPx: number;
  gapPx: number;
}

function fullRenderWindow(itemCount: number): GridWindow {
  return {
    startIndex: 0,
    endIndex: itemCount - 1,
    columns: 1,
    topPadPx: 0,
    bottomPadPx: 0,
    windowed: false,
  };
}

function readGapPx(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const gap = parseFloat(cs.rowGap || cs.gap || '0');
  return Number.isFinite(gap) ? gap : 0;
}

/**
 * Derive the current column count and per-row height from the grid element's
 * rendered width and the CSS `--thumbnail-min-size`. Cells are square
 * (aspect-ratio 1/1), so a cell's height equals its width.
 */
function measure(el: HTMLElement): Metrics | null {
  const rect = el.getBoundingClientRect();
  const width = rect.width;
  // No layout (jsdom) or not yet measured: bail to full render.
  if (!Number.isFinite(width) || width <= 0) return null;

  const gapPx = readGapPx(el);

  // --thumbnail-min-size may be set on :root; resolve via the element's own
  // computed style so we honour any cascade. Falls back to the CSS default.
  const minSizeRaw = getComputedStyle(el).getPropertyValue('--thumbnail-min-size').trim();
  let minSize = parseFloat(minSizeRaw);
  if (!Number.isFinite(minSize) || minSize <= 0) minSize = 160;

  // auto-fill column count: how many minmax(minSize, 1fr) tracks fit, matching
  // the browser's `repeat(auto-fill, ...)` math: floor((width + gap) / (min + gap)).
  let columns = Math.floor((width + gapPx) / (minSize + gapPx));
  if (!Number.isFinite(columns) || columns < 1) columns = 1;

  // Actual cell width once columns are fixed: (width - (cols-1)*gap) / cols.
  const cellWidth = (width - (columns - 1) * gapPx) / columns;
  const rowHeightPx = cellWidth + gapPx; // square cell + the row gap below it
  if (!Number.isFinite(rowHeightPx) || rowHeightPx <= 0) return null;

  const scrollY = window.scrollY || window.pageYOffset || 0;
  const gridTopPx = rect.top + scrollY;

  return { columns, rowHeightPx, gridTopPx, gapPx };
}

/**
 * Returns the current render window for `itemCount` items rendered into the
 * grid referenced by `gridRef`. Recomputes on scroll, resize, and whenever
 * `itemCount` or `thumbnailSizeKey` change (the latter changes column geometry).
 *
 * `forceIndex`, when >= 0, guarantees that index is inside the returned window
 * even if it would otherwise be scrolled out (used to keep the lightbox's
 * current image mounted so its thumbnail rect can be read for the zoom
 * animation).
 */
export function useGridWindow(
  gridRef: { current: HTMLElement | null },
  itemCount: number,
  thumbnailSizeKey: unknown,
  forceIndex: number,
): GridWindow {
  const [win, setWin] = useState<GridWindow>(() => fullRenderWindow(itemCount));

  // Latest forceIndex without retriggering the listener wiring on every change.
  const forceIndexRef = useRef(forceIndex);
  forceIndexRef.current = forceIndex;

  const recompute = useCallback(() => {
    const el = gridRef.current;
    if (!el || itemCount <= 0) {
      const next = fullRenderWindow(itemCount);
      setWin(prev => (shallowEqualWindow(prev, next) ? prev : next));
      return;
    }

    const m = measure(el);
    if (!m) {
      // No usable layout — render everything.
      const next = fullRenderWindow(itemCount);
      setWin(prev => (shallowEqualWindow(prev, next) ? prev : next));
      return;
    }

    const { columns, rowHeightPx, gridTopPx, gapPx } = m;
    const totalRows = Math.ceil(itemCount / columns);

    // Tiny lists: not worth windowing; rendering all avoids spacer edge-cases.
    if (totalRows <= OVERSCAN_ROWS * 2 + 1) {
      const next: GridWindow = {
        startIndex: 0,
        endIndex: itemCount - 1,
        columns,
        topPadPx: 0,
        bottomPadPx: 0,
        windowed: false,
      };
      setWin(prev => (shallowEqualWindow(prev, next) ? prev : next));
      return;
    }

    const viewportTop = window.scrollY || window.pageYOffset || 0;
    const viewportHeight = window.innerHeight || 0;

    // Offset of the viewport relative to the grid's top, in px.
    const relTop = viewportTop - gridTopPx;
    let firstVisibleRow = Math.floor(relTop / rowHeightPx) - OVERSCAN_ROWS;
    let lastVisibleRow = Math.ceil((relTop + viewportHeight) / rowHeightPx) + OVERSCAN_ROWS;
    if (firstVisibleRow < 0) firstVisibleRow = 0;
    if (lastVisibleRow > totalRows - 1) lastVisibleRow = totalRows - 1;
    if (lastVisibleRow < firstVisibleRow) lastVisibleRow = firstVisibleRow;

    let startIndex = firstVisibleRow * columns;
    let endIndex = Math.min(itemCount - 1, (lastVisibleRow + 1) * columns - 1);

    // Keep a forced index (lightbox current image) mounted by expanding the
    // window to include its whole row.
    const fi = forceIndexRef.current;
    if (fi >= 0 && fi < itemCount) {
      const forcedRow = Math.floor(fi / columns);
      const rowStart = forcedRow * columns;
      const rowEnd = Math.min(itemCount - 1, rowStart + columns - 1);
      if (rowStart < startIndex) startIndex = rowStart;
      if (rowEnd > endIndex) endIndex = rowEnd;
    }

    const renderedStartRow = Math.floor(startIndex / columns);
    const renderedEndRow = Math.floor(endIndex / columns);
    const rowsAbove = renderedStartRow;
    const rowsBelow = totalRows - 1 - renderedEndRow;

    // Spacer heights. A full row occupies rowHeightPx (square cell + the row
    // gap below it). The spacers stand in for the collapsed rows. Subtract one
    // gap from the bottom spacer because no gap follows the final grid row.
    const topPadPx = rowsAbove > 0 ? rowsAbove * rowHeightPx : 0;
    const bottomPadPx = rowsBelow > 0 ? rowsBelow * rowHeightPx - gapPx : 0;

    const next: GridWindow = {
      startIndex,
      endIndex,
      columns,
      topPadPx: Math.max(0, topPadPx),
      bottomPadPx: Math.max(0, bottomPadPx),
      windowed: true,
    };
    setWin(prev => (shallowEqualWindow(prev, next) ? prev : next));
  }, [gridRef, itemCount]);

  // Recompute on mount, item-count change, thumbnail-size change, and when the
  // forced (lightbox) index changes.
  useEffect(() => {
    recompute();
  }, [recompute, thumbnailSizeKey, forceIndex]);

  // Scroll / resize listeners (passive). rAF-coalesced so a burst of scroll
  // events triggers at most one recompute per frame.
  useEffect(() => {
    let scheduled = false;
    const onChange = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        recompute();
      });
    };
    window.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);

    // ResizeObserver catches grid-width changes that aren't window resizes
    // (e.g. layout shifts, font-load reflow).
    let ro: ResizeObserver | null = null;
    const el = gridRef.current;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onChange);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
      ro?.disconnect();
    };
  }, [recompute, gridRef]);

  return win;
}

function shallowEqualWindow(a: GridWindow, b: GridWindow): boolean {
  return (
    a.startIndex === b.startIndex &&
    a.endIndex === b.endIndex &&
    a.columns === b.columns &&
    a.topPadPx === b.topPadPx &&
    a.bottomPadPx === b.bottomPadPx &&
    a.windowed === b.windowed
  );
}
