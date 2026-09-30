import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React from 'react';
import LightboxContainer from '../src/components/LightboxContainer';
import { __resetPreloadCacheForTests } from '../src/utils/preloadImage';
import type { ImageData } from '../src/types/api';

/**
 * Neighbor preloading (fringematrix5-nzp2.2): once the current full-res image
 * has loaded, the lightbox warms idx±1 so paging is instant. It must wait for
 * the current image so neighbors never compete with it for bandwidth.
 */

const images: ImageData[] = ['a', 'b', 'c', 'd'].map((n) => ({ fileName: `${n}.jpg`, src: `https://cdn/${n}.jpg` }));

let requested: string[];
const OriginalImage = globalThis.Image;

beforeEach(() => {
  __resetPreloadCacheForTests();
  requested = [];
  class FakeImage {
    decoding = '';
    set src(v: string) { requested.push(v); }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;
});

afterEach(() => {
  globalThis.Image = OriginalImage;
});

function renderLightbox(index: number, open = true) {
  const props = {
    images,
    lightboxIndex: index,
    isLightboxOpen: open,
    hideLightboxImage: false,
    activeCampaign: null,
    campaigns: [],
    setLightboxIndex: () => {},
    closeLightbox: () => {},
    isAnimatingRef: { current: false },
  };
  const utils = render(<LightboxContainer {...props} />);
  return { ...utils, rerenderAt: (i: number) => utils.rerender(<LightboxContainer {...props} lightboxIndex={i} />) };
}

describe('LightboxContainer neighbor preloading', () => {
  it('waits for the current image to load, then warms next and previous', () => {
    const { container } = renderLightbox(1);
    // jsdom never loads images, so `complete` is false until we fire load.
    expect(requested).toEqual([]);

    const img = container.querySelector('#lightbox-image')!;
    act(() => { fireEvent.load(img); });
    expect(requested).toEqual(['https://cdn/c.jpg', 'https://cdn/a.jpg']);
  });

  it('warms the new neighbors after navigating', () => {
    const { container, rerenderAt } = renderLightbox(1);
    act(() => { fireEvent.load(container.querySelector('#lightbox-image')!); });
    requested = [];

    rerenderAt(2);
    act(() => { fireEvent.load(container.querySelector('#lightbox-image')!); });
    // c.jpg's neighbors are d (new) and b (new); a/c were already warmed.
    expect(requested).toEqual(['https://cdn/d.jpg', 'https://cdn/b.jpg']);
  });

  it('does nothing while the lightbox is closed', () => {
    renderLightbox(1, false);
    expect(requested).toEqual([]);
  });
});
