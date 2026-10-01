import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridWindow } from '../../src/hooks/useGridWindow';

/**
 * Direct tests of the windowing math in useGridWindow. jsdom has no layout,
 * so the grid element's getBoundingClientRect, its computed style (gap and
 * --thumbnail-min-size), window.innerHeight/scrollY, requestAnimationFrame
 * and ResizeObserver are all stubbed.
 *
 * Default geometry: width 1000, gap 10, min 160
 *   columns   = floor((1000+10)/(160+10)) = 5
 *   cellWidth = (1000 - 4*10)/5 = 192
 *   rowHeight = 192 + 10 = 202
 */
const ROW_H = 202;
const COLS = 5;

interface Geometry {
  width: number;
  /** Grid's absolute document top. rect.top is derived as gridTop - scrollY. */
  gridTop: number;
  gap: string;
  minSize: string;
}

let geom: Geometry;
let el: HTMLDivElement;
let rafQueue: FrameRequestCallback[];
let roInstances: Array<{ cb: ResizeObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }>;

function setScroll(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
}

function flushRaf() {
  const q = rafQueue;
  rafQueue = [];
  act(() => {
    q.forEach((cb) => cb(0));
  });
}

beforeEach(() => {
  geom = { width: 1000, gridTop: 0, gap: '10px', minSize: '160px' };
  el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ width: geom.width, top: geom.gridTop - (window.scrollY || 0) }) as DOMRect;

  const realGCS = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(((target: Element) => {
    if (target === el) {
      return {
        rowGap: geom.gap,
        gap: geom.gap,
        getPropertyValue: (p: string) => (p === '--thumbnail-min-size' ? geom.minSize : ''),
      } as unknown as CSSStyleDeclaration;
    }
    return realGCS(target);
  }) as typeof window.getComputedStyle);

  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
  setScroll(0);

  rafQueue = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });

  roInstances = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      constructor(public cb: ResizeObserverCallback) {
        roInstances.push(this as unknown as (typeof roInstances)[number]);
      }
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setScroll(0);
});

function renderWindow(itemCount: number, forceIndex = -1, ref: { current: HTMLElement | null } = { current: el }) {
  return renderHook(
    ({ count, fi, key }: { count: number; fi: number; key: unknown }) => useGridWindow(ref, count, key, fi),
    { initialProps: { count: itemCount, fi: forceIndex, key: 1 as unknown } },
  );
}

describe('useGridWindow — fallbacks', () => {
  it('renders everything when the ref is empty', () => {
    const { result } = renderWindow(20, -1, { current: null });
    expect(result.current).toEqual({
      startIndex: 0,
      endIndex: 19,
      columns: 1,
      topPadPx: 0,
      bottomPadPx: 0,
      windowed: false,
    });
  });

  it('handles itemCount 0 (endIndex -1)', () => {
    const { result } = renderWindow(0);
    expect(result.current.windowed).toBe(false);
    expect(result.current.endIndex).toBe(-1);
  });

  it('renders everything when the grid has no width (no layout)', () => {
    geom.width = 0;
    const { result } = renderWindow(500);
    expect(result.current.windowed).toBe(false);
    expect(result.current.endIndex).toBe(499);
    expect(result.current.columns).toBe(1);
  });

  it('does not window tiny lists but still reports measured columns', () => {
    // 35 items / 5 cols = 7 rows <= 2*3+1
    const { result } = renderWindow(35);
    expect(result.current).toMatchObject({ windowed: false, columns: COLS, startIndex: 0, endIndex: 34 });
  });

  it('windows once the list exceeds the overscan threshold (8 rows)', () => {
    const { result } = renderWindow(36); // 8 rows
    expect(result.current.windowed).toBe(true);
  });
});

describe('useGridWindow — geometry', () => {
  it('computes the window at the top of the page', () => {
    // 500 items → 100 rows; visible rows 0..ceil(800/202)=4, +3 overscan → 7
    const { result } = renderWindow(500);
    expect(result.current).toEqual({
      startIndex: 0,
      endIndex: 8 * COLS - 1,
      columns: COLS,
      topPadPx: 0,
      bottomPadPx: (100 - 1 - 7) * ROW_H - 10,
      windowed: true,
    });
  });

  it('computes the window mid-scroll with top and bottom spacers', () => {
    setScroll(10 * ROW_H); // 2020
    const { result } = renderWindow(500);
    // first = 10 - 3 = 7; last = ceil((2020+800)/202) + 3 = 14 + 3 = 17
    expect(result.current).toEqual({
      startIndex: 7 * COLS,
      endIndex: 18 * COLS - 1,
      columns: COLS,
      topPadPx: 7 * ROW_H,
      bottomPadPx: (100 - 1 - 17) * ROW_H - 10,
      windowed: true,
    });
  });

  it('accounts for the grid document offset', () => {
    geom.gridTop = 500;
    setScroll(500 + 10 * ROW_H);
    const { result } = renderWindow(500);
    expect(result.current.startIndex).toBe(7 * COLS);
  });

  it('clamps the last row to the end of the list', () => {
    setScroll(97 * ROW_H);
    const { result } = renderWindow(500);
    expect(result.current.endIndex).toBe(499);
    expect(result.current.bottomPadPx).toBe(0);
    expect(result.current.startIndex).toBe(94 * COLS);
  });

  it('handles a partial final row', () => {
    setScroll(97 * ROW_H);
    const { result } = renderWindow(498); // last row has 3 items
    expect(result.current.endIndex).toBe(497);
  });

  it('falls back to 160px min size and 0 gap for unusable CSS values', () => {
    geom.minSize = '';
    geom.gap = 'normal';
    // cols = floor(1000/160) = 6, rowHeight = 1000/6
    const { result } = renderWindow(600);
    expect(result.current.columns).toBe(6);
    const rowH = 1000 / 6;
    const last = Math.ceil(800 / rowH) + 3; // 5 + 3 = 8
    expect(result.current.endIndex).toBe((last + 1) * 6 - 1);
    expect(result.current.bottomPadPx).toBeCloseTo((100 - 1 - last) * rowH, 5);
  });

  it('uses at least one column when the grid is narrower than the min size', () => {
    geom.width = 100;
    const { result } = renderWindow(100);
    expect(result.current.columns).toBe(1);
    expect(result.current.windowed).toBe(true);
    // rowHeight = 100 + 10 = 110; last = ceil(800/110)+3 = 8+3 = 11
    expect(result.current.endIndex).toBe(11);
  });

  it('respects a custom --thumbnail-min-size', () => {
    geom.minSize = '90px';
    const { result } = renderWindow(500);
    // floor(1010/100) = 10 columns
    expect(result.current.columns).toBe(10);
  });
});

describe('useGridWindow — forceIndex', () => {
  it('extends the window downward to include a forced index row', () => {
    const { result } = renderWindow(500, 452); // row 90
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(454);
    expect(result.current.bottomPadPx).toBe((100 - 1 - 90) * ROW_H - 10);
  });

  it('extends the window upward to include a forced index row', () => {
    setScroll(50 * ROW_H);
    const { result } = renderWindow(500, 3); // row 0
    expect(result.current.startIndex).toBe(0);
    expect(result.current.topPadPx).toBe(0);
  });

  it('ignores an out-of-range forced index', () => {
    const { result } = renderWindow(500, 9999);
    expect(result.current.endIndex).toBe(39);
  });

  it('recomputes when forceIndex changes', () => {
    const { result, rerender } = renderWindow(500, -1);
    expect(result.current.endIndex).toBe(39);
    rerender({ count: 500, fi: 250, key: 1 });
    expect(result.current.endIndex).toBe(254);
  });
});

describe('useGridWindow — recompute triggers', () => {
  it('recomputes on scroll, coalescing a burst into one animation frame', () => {
    const { result } = renderWindow(500);
    expect(result.current.startIndex).toBe(0);
    setScroll(10 * ROW_H);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });
    expect(rafQueue).toHaveLength(1);
    flushRaf();
    expect(result.current.startIndex).toBe(7 * COLS);

    // After the frame runs, a new scroll schedules again.
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(rafQueue).toHaveLength(1);
  });

  it('recomputes on window resize', () => {
    const { result } = renderWindow(500);
    geom.width = 500; // floor(510/170) = 3 columns
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    flushRaf();
    expect(result.current.columns).toBe(3);
  });

  it('observes the grid with ResizeObserver and recomputes on callback', () => {
    const { result, unmount } = renderWindow(500);
    expect(roInstances).toHaveLength(1);
    expect(roInstances[0].observe).toHaveBeenCalledWith(el);
    geom.width = 340; // floor(350/170) = 2
    act(() => {
      roInstances[0].cb([], roInstances[0] as unknown as ResizeObserver);
    });
    flushRaf();
    expect(result.current.columns).toBe(2);
    unmount();
    expect(roInstances[0].disconnect).toHaveBeenCalled();
  });

  it('works without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { result } = renderWindow(500);
    expect(result.current.windowed).toBe(true);
  });

  it('recomputes when thumbnailSizeKey changes', () => {
    const { result, rerender } = renderWindow(500);
    geom.minSize = '90px';
    rerender({ count: 500, fi: -1, key: 2 });
    expect(result.current.columns).toBe(10);
  });

  it('recomputes when itemCount changes', () => {
    const { result, rerender } = renderWindow(500);
    rerender({ count: 20, fi: -1, key: 1 });
    expect(result.current).toMatchObject({ windowed: false, endIndex: 19 });
  });

  it('keeps the same object when nothing changed (no extra renders)', () => {
    const { result } = renderWindow(500);
    const before = result.current;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    flushRaf();
    expect(result.current).toBe(before);
  });

  it('removes scroll/resize listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderWindow(500);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

describe('useGridWindow — viewport below the grid', () => {
  // Regression: when the viewport top is more than OVERSCAN_ROWS rows past
  // the end of the grid (e.g. switching from a large campaign to a smaller one
  // while scrolled deep), firstVisibleRow used to be unclamped, giving
  // startIndex > endIndex (no cards) and a top spacer taller than the grid.
  it('never returns an inverted window or a top spacer taller than the grid', () => {
    setScroll(120 * ROW_H);
    const { result } = renderWindow(500);
    expect(result.current.startIndex).toBeLessThanOrEqual(result.current.endIndex);
    expect(result.current.topPadPx).toBeLessThanOrEqual(100 * ROW_H - 10);
    // The last row must be rendered so the user sees the end of the grid.
    expect(result.current.endIndex).toBe(499);
  });
});
