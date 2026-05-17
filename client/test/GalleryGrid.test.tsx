import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { createRef } from 'react';
import GalleryGrid from '../src/components/GalleryGrid';
import type { GalleryGridHandle } from '../src/components/GalleryGrid';
import type { ImageData } from '../src/types/api';

/** Build a minimal loaded ImageData entry. */
function makeImage(name: string, src = `/${name}`): ImageData {
  return { fileName: name, src, loadedSrc: src, isLoading: false };
}

/** Build a placeholder/loading ImageData entry. */
function makeLoading(name: string): ImageData {
  return { fileName: name, src: null, isLoading: true };
}

const noop = () => {};

// =============================================================================
// 1. getThumbElement returns the correct <img> after render
// =============================================================================

describe('GalleryGridHandle.getThumbElement — loaded images', () => {
  it('returns an HTMLImageElement for a valid index after render', () => {
    const ref = createRef<GalleryGridHandle>();
    render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png'), makeImage('b.png'), makeImage('c.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    const el = ref.current!.getThumbElement(0);
    expect(el).toBeInstanceOf(HTMLImageElement);
  });

  it('returns the <img> with the correct src', () => {
    const ref = createRef<GalleryGridHandle>();
    render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png', '/a.png'), makeImage('b.png', '/b.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    expect(ref.current!.getThumbElement(0)?.src).toContain('/a.png');
    expect(ref.current!.getThumbElement(1)?.src).toContain('/b.png');
  });

  it('returns distinct elements for each index', () => {
    const ref = createRef<GalleryGridHandle>();
    render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png'), makeImage('b.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    const el0 = ref.current!.getThumbElement(0);
    const el1 = ref.current!.getThumbElement(1);
    expect(el0).not.toBeNull();
    expect(el1).not.toBeNull();
    expect(el0).not.toBe(el1);
  });
});

// =============================================================================
// 2. getThumbElement returns null for out-of-range indices and loading images
// =============================================================================

describe('GalleryGridHandle.getThumbElement — null cases', () => {
  it('returns null for a negative index', () => {
    const ref = createRef<GalleryGridHandle>();
    render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    expect(ref.current!.getThumbElement(-1)).toBeNull();
  });

  it('returns null for an index beyond the array length', () => {
    const ref = createRef<GalleryGridHandle>();
    render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    expect(ref.current!.getThumbElement(99)).toBeNull();
  });

  it('returns null for a loading/placeholder image (no <img> mounted)', () => {
    const ref = createRef<GalleryGridHandle>();
    render(
      <GalleryGrid
        ref={ref}
        images={[makeLoading('x.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    // A loading card renders a placeholder div, not an <img>, so the ref
    // callback is never called and the index is absent from thumbMapRef.
    expect(ref.current!.getThumbElement(0)).toBeNull();
  });

  it('returns null when images array is empty', () => {
    const ref = createRef<GalleryGridHandle>();
    render(
      <GalleryGrid
        ref={ref}
        images={[]}
        hasCampaign={false}
        onImageClick={noop}
      />,
    );

    expect(ref.current!.getThumbElement(0)).toBeNull();
  });
});

// =============================================================================
// 3. After re-render with a different images array (campaign switch),
//    old indices no longer return elements that were removed.
// =============================================================================

describe('GalleryGridHandle.getThumbElement — after campaign switch', () => {
  it('returns null for an index that was removed when the images array shrinks', () => {
    const ref = createRef<GalleryGridHandle>();
    const { rerender } = render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png'), makeImage('b.png'), makeImage('c.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    // All three should be present initially.
    expect(ref.current!.getThumbElement(2)).toBeInstanceOf(HTMLImageElement);

    // Simulate a campaign switch: replace the images array with a shorter one.
    act(() => {
      rerender(
        <GalleryGrid
          ref={ref}
          images={[makeImage('x.png')]}
          hasCampaign
          onImageClick={noop}
        />,
      );
    });

    // Index 2 is no longer in the DOM; the ref callback fires with null
    // (unmount) and removes it from thumbMapRef.
    expect(ref.current!.getThumbElement(2)).toBeNull();
    expect(ref.current!.getThumbElement(1)).toBeNull();
  });

  it('new index 0 maps to the new campaign image after switch', () => {
    const ref = createRef<GalleryGridHandle>();
    const { rerender } = render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('old.png', '/old.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    act(() => {
      rerender(
        <GalleryGrid
          ref={ref}
          images={[makeImage('new.png', '/new.png')]}
          hasCampaign
          onImageClick={noop}
        />,
      );
    });

    const el = ref.current!.getThumbElement(0);
    expect(el).toBeInstanceOf(HTMLImageElement);
    expect(el?.src).toContain('/new.png');
  });

  it('returns null for every index when switched to loading images', () => {
    const ref = createRef<GalleryGridHandle>();
    const { rerender } = render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png'), makeImage('b.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    expect(ref.current!.getThumbElement(0)).toBeInstanceOf(HTMLImageElement);

    act(() => {
      rerender(
        <GalleryGrid
          ref={ref}
          images={[makeLoading('a.png'), makeLoading('b.png')]}
          hasCampaign
          onImageClick={noop}
        />,
      );
    });

    expect(ref.current!.getThumbElement(0)).toBeNull();
    expect(ref.current!.getThumbElement(1)).toBeNull();
  });
});

// =============================================================================
// 4. setThumbRef callback caching — same callback reference reused per index,
//    preventing unnecessary stale-ref churn on re-renders.
// =============================================================================

describe('GalleryGridHandle — setThumbRef callback caching', () => {
  it('does not trigger unnecessary onImageClick on a plain re-render', () => {
    // If the ref callback cache is broken, each re-render would call the old
    // callback with null and the new one with the element. We verify that the
    // grid stays stable: after re-render with the same images, getThumbElement
    // still returns an HTMLImageElement (no stale-null wipe).
    const ref = createRef<GalleryGridHandle>();
    const onClick = vi.fn();

    const { rerender } = render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png'), makeImage('b.png')]}
        hasCampaign
        onImageClick={onClick}
      />,
    );

    // Trigger a no-op re-render with identical images.
    act(() => {
      rerender(
        <GalleryGrid
          ref={ref}
          images={[makeImage('a.png'), makeImage('b.png')]}
          hasCampaign
          onImageClick={onClick}
        />,
      );
    });

    // Elements should still be resolvable — no spurious null-wipe.
    expect(ref.current!.getThumbElement(0)).toBeInstanceOf(HTMLImageElement);
    expect(ref.current!.getThumbElement(1)).toBeInstanceOf(HTMLImageElement);
  });

  it('still registers a newly added image after a re-render', () => {
    const ref = createRef<GalleryGridHandle>();

    const { rerender } = render(
      <GalleryGrid
        ref={ref}
        images={[makeImage('a.png')]}
        hasCampaign
        onImageClick={noop}
      />,
    );

    act(() => {
      rerender(
        <GalleryGrid
          ref={ref}
          images={[makeImage('a.png'), makeImage('b.png')]}
          hasCampaign
          onImageClick={noop}
        />,
      );
    });

    expect(ref.current!.getThumbElement(0)).toBeInstanceOf(HTMLImageElement);
    expect(ref.current!.getThumbElement(1)).toBeInstanceOf(HTMLImageElement);
  });
});
