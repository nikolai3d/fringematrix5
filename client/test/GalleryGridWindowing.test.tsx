import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { createRef } from 'react';
import GalleryGrid, { type GalleryGridHandle } from '../src/components/GalleryGrid';
import type { ImageData } from '../src/types/api';

/**
 * Windowing behaviour tests.
 *
 * jsdom performs no layout, so useGridWindow normally falls back to rendering
 * everything. To exercise the windowing math we stub the geometry primitives
 * the hook reads: the grid's getBoundingClientRect (width + top), the computed
 * --thumbnail-min-size / gap, and the window viewport size. With those in place
 * the hook activates and renders only the rows intersecting the (stubbed)
 * viewport plus overscan.
 */

function makeImage(name: string, src = `/${name}`): ImageData {
  return { fileName: name, src, loadedSrc: src, isLoading: false };
}

const noop = () => {};

const GRID_WIDTH = 1000; // px
const MIN_SIZE = 160; // --thumbnail-min-size
const GAP = 10;
const VIEWPORT_HEIGHT = 800;
// floor((1000 + 10) / (160 + 10)) = floor(1010/170) = 5 columns
const EXPECTED_COLUMNS = 5;

let originalGBCR: typeof HTMLElement.prototype.getBoundingClientRect;
let originalGCS: typeof window.getComputedStyle;

beforeEach(() => {
  originalGBCR = HTMLElement.prototype.getBoundingClientRect;
  originalGCS = window.getComputedStyle;

  // Grid sits at document top (top = 0 - scrollY). For simplicity keep the
  // grid's rect.top fixed at 0 and drive the window via scrollY.
  HTMLElement.prototype.getBoundingClientRect = function () {
    if ((this as HTMLElement).classList?.contains('gallery-grid')) {
      const scrollY = window.scrollY || 0;
      return {
        width: GRID_WIDTH,
        height: 5000,
        top: 0 - scrollY,
        left: 0,
        right: GRID_WIDTH,
        bottom: 5000 - scrollY,
        x: 0,
        y: 0 - scrollY,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return {
      width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect;
  };

  vi.spyOn(window, 'getComputedStyle').mockImplementation(((el: Element) => {
    if ((el as HTMLElement).classList?.contains('gallery-grid')) {
      return {
        gap: `${GAP}px`,
        rowGap: `${GAP}px`,
        getPropertyValue: (p: string) => (p === '--thumbnail-min-size' ? `${MIN_SIZE}px` : ''),
      } as unknown as CSSStyleDeclaration;
    }
    return { gap: '0px', rowGap: '0px', getPropertyValue: () => '' } as unknown as CSSStyleDeclaration;
  }) as typeof window.getComputedStyle);

  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_HEIGHT, configurable: true });
  window.scrollY = 0;
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGBCR;
  (window.getComputedStyle as unknown as { mockRestore?: () => void }).mockRestore?.();
  window.getComputedStyle = originalGCS;
  vi.restoreAllMocks();
});

describe('GalleryGrid windowing — large list renders a windowed subset', () => {
  it('renders far fewer cards than the full list and inserts a bottom spacer', () => {
    const total = 500;
    const images = Array.from({ length: total }, (_, i) => makeImage(`img${i}.png`));
    const { container } = render(<GalleryGrid images={images} onImageClick={noop} />);

    const cardCount = container.querySelectorAll('.card').length;
    // Windowing must be active: only a small fraction of 500 cards renders.
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThan(total);
    // Viewport 800px / row ~ (1000-4*10)/5 + 10 = 202px -> ~4 rows visible
    // + 2*3 overscan rows = ~10 rows * 5 cols = ~50 cards. Generous upper bound.
    expect(cardCount).toBeLessThanOrEqual(EXPECTED_COLUMNS * 14);

    // At scroll top there's no top spacer but there must be a bottom spacer
    // reserving the remaining rows.
    expect(container.querySelector('[data-testid="gallery-grid-spacer-top"]')).toBeNull();
    const bottom = container.querySelector('[data-testid="gallery-grid-spacer-bottom"]') as HTMLElement | null;
    expect(bottom).not.toBeNull();
    expect(parseFloat(bottom!.style.height)).toBeGreaterThan(0);
  });

  it('renders the first cards (index 0) at scroll top', () => {
    const images = Array.from({ length: 500 }, (_, i) => makeImage(`img${i}.png`));
    const ref = createRef<GalleryGridHandle>();
    render(<GalleryGrid ref={ref} images={images} onImageClick={noop} />);
    expect(ref.current!.getThumbElement(0)).toBeInstanceOf(HTMLImageElement);
  });

  it('does NOT mount a far-off-screen index when not forced', () => {
    const images = Array.from({ length: 500 }, (_, i) => makeImage(`img${i}.png`));
    const ref = createRef<GalleryGridHandle>();
    render(<GalleryGrid ref={ref} images={images} onImageClick={noop} />);
    // Index 499 is far below the viewport at scroll top: must be windowed out.
    expect(ref.current!.getThumbElement(499)).toBeNull();
  });
});

describe('GalleryGrid windowing — forceMountIndex keeps a target card mounted', () => {
  it('mounts an otherwise-off-screen index so its thumbnail rect is readable (lightbox-open-at-index)', () => {
    const images = Array.from({ length: 500 }, (_, i) => makeImage(`img${i}.png`));
    const ref = createRef<GalleryGridHandle>();
    const { rerender } = render(
      <GalleryGrid ref={ref} images={images} onImageClick={noop} forceMountIndex={-1} />,
    );

    // Without forcing, index 480 is not mounted.
    expect(ref.current!.getThumbElement(480)).toBeNull();

    // Simulate the lightbox opening/paging to index 480 (App sets
    // forceMountIndex). The card must now be in the DOM.
    act(() => {
      rerender(
        <GalleryGrid ref={ref} images={images} onImageClick={noop} forceMountIndex={480} />,
      );
    });

    const el = ref.current!.getThumbElement(480);
    expect(el).toBeInstanceOf(HTMLImageElement);
    expect(el?.src).toContain('/img480.png');
  });
});
