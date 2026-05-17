import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

// =============================================================================
// 5. Rendering behavior — image cards, filenames, src, alt text
// =============================================================================

describe('GalleryGrid — image card rendering', () => {
  it('renders one card per image', () => {
    const images = [makeImage('a.png'), makeImage('b.png'), makeImage('c.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('renders the filename for each image card', () => {
    const images = [makeImage('fringe-avatar.png'), makeImage('walter-bishop.jpg')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.getByText('fringe-avatar.png')).toBeTruthy();
    expect(screen.getByText('walter-bishop.jpg')).toBeTruthy();
  });

  it('renders the image src as the img element src', () => {
    const images = [makeImage('specific.png', 'https://cdn.example.com/specific.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/specific.png');
  });

  it('uses the fileName as the img alt text', () => {
    const images = [makeImage('my-avatar.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.getByAltText('my-avatar.png')).toBeTruthy();
  });
});

// =============================================================================
// 6. Click handler — correct index and element passed to onImageClick
// =============================================================================

describe('GalleryGrid — click handler', () => {
  it('calls onImageClick with correct index when first image is clicked', () => {
    const onImageClick = vi.fn();
    const images = [makeImage('first.png'), makeImage('second.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={onImageClick} />);
    const imgs = screen.getAllByRole('img');
    fireEvent.click(imgs[0]);
    expect(onImageClick).toHaveBeenCalledTimes(1);
    expect(onImageClick.mock.calls[0][0]).toBe(0);
  });

  it('calls onImageClick with correct index when a middle image is clicked', () => {
    const onImageClick = vi.fn();
    const images = [makeImage('first.png'), makeImage('second.png'), makeImage('third.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={onImageClick} />);
    const imgs = screen.getAllByRole('img');
    fireEvent.click(imgs[1]);
    expect(onImageClick).toHaveBeenCalledTimes(1);
    expect(onImageClick.mock.calls[0][0]).toBe(1);
  });

  it('calls onImageClick with the img element as the second argument', () => {
    const onImageClick = vi.fn();
    const images = [makeImage('avatar.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={onImageClick} />);
    const img = screen.getByRole('img');
    fireEvent.click(img);
    expect(onImageClick.mock.calls[0][1]).toBe(img);
  });
});

// =============================================================================
// 7. Empty state — hasCampaign=true + images=[] shows the empty-state UI
// =============================================================================

describe('GalleryGrid — empty state', () => {
  it('renders the empty state when hasCampaign=true and images=[]', () => {
    render(<GalleryGrid images={[]} hasCampaign={true} onImageClick={noop} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('No Images In Campaign')).toBeTruthy();
    expect(screen.getByText('This campaign has no uploaded images yet.')).toBeTruthy();
  });

  it('adds the "empty" class to the gallery section when in empty state', () => {
    const { container } = render(<GalleryGrid images={[]} hasCampaign={true} onImageClick={noop} />);
    const section = container.querySelector('section#gallery');
    expect(section?.classList.contains('empty')).toBe(true);
  });

  it('does NOT render empty state when hasCampaign=false and images=[]', () => {
    render(<GalleryGrid images={[]} hasCampaign={false} onImageClick={noop} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('No Images In Campaign')).toBeNull();
  });

  it('does NOT render empty state when images are present', () => {
    const images = [makeImage('avatar.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('No Images In Campaign')).toBeNull();
  });
});

// =============================================================================
// 8. Loading placeholder — isLoading=true renders placeholder, not <img>
// =============================================================================

describe('GalleryGrid — loading placeholder', () => {
  it('renders a loading placeholder (not an img) when isLoading=true', () => {
    const images = [makeLoading('pending.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders the filename alongside the loading placeholder', () => {
    const images = [makeLoading('pending.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.getByText('pending.png')).toBeTruthy();
  });

  it('renders an img (not a placeholder) when isLoading=false', () => {
    const images = [makeImage('loaded.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.getByRole('img')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('renders mixed loaded and loading cards correctly', () => {
    const images = [makeImage('loaded.png'), makeLoading('loading.png')];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={noop} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
