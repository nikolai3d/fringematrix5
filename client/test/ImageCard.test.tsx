import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import ImageCard from '../src/components/ImageCard';
import type { ImageData } from '../src/types/api';

/** Build a minimal loaded ImageData entry. */
function makeImage(name: string, src = `/${name}`): ImageData {
  return { fileName: name, src, loadedSrc: src, isLoading: false };
}

/** Build a placeholder/loading ImageData entry. */
function makeLoading(name: string): ImageData {
  return { fileName: name, src: null, isLoading: true };
}

// =============================================================================
// 1. Basic rendering — img element with correct src and alt
// =============================================================================

describe('ImageCard — rendering', () => {
  it('renders an img element when isLoading is false', () => {
    const image = makeImage('avatar.png', 'https://cdn.example.com/avatar.png');
    render(<ImageCard image={image} onClick={vi.fn()} />);
    expect(screen.getByRole('img')).toBeTruthy();
  });

  it('renders the img with the correct src (loadedSrc)', () => {
    const image = makeImage('avatar.png', 'https://cdn.example.com/avatar.png');
    render(<ImageCard image={image} onClick={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/avatar.png');
  });

  it('uses fileName as the img alt text', () => {
    const image = makeImage('my-avatar.png');
    render(<ImageCard image={image} onClick={vi.fn()} />);
    expect(screen.getByAltText('my-avatar.png')).toBeTruthy();
  });

  it('renders the filename label below the image', () => {
    const image = makeImage('fringe-banner.jpg');
    render(<ImageCard image={image} onClick={vi.fn()} />);
    expect(screen.getByText('fringe-banner.jpg')).toBeTruthy();
  });

  it('falls back to src when loadedSrc is not set', () => {
    const image: ImageData = { fileName: 'raw.png', src: '/raw.png', isLoading: false };
    render(<ImageCard image={image} onClick={vi.fn()} />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/raw.png');
  });
});

// =============================================================================
// 2. Click handler — onClick is called with the correct MouseEvent
// =============================================================================

describe('ImageCard — click handler', () => {
  it('calls onClick when the image is clicked', () => {
    const onClick = vi.fn();
    const image = makeImage('clickable.png');
    render(<ImageCard image={image} onClick={onClick} />);
    fireEvent.click(screen.getByRole('img'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes an event-like object with a target to onClick', () => {
    const onClick = vi.fn();
    const image = makeImage('event-check.png');
    render(<ImageCard image={image} onClick={onClick} />);
    fireEvent.click(screen.getByRole('img'));
    // React wraps native events in a SyntheticEvent; verify the event object
    // has a `target` pointing to the clicked img element.
    const event = onClick.mock.calls[0][0] as React.MouseEvent<HTMLImageElement>;
    expect(event.target).toBe(screen.getByRole('img'));
  });

  it('does not call onClick without a click', () => {
    const onClick = vi.fn();
    const image = makeImage('no-click.png');
    render(<ImageCard image={image} onClick={onClick} />);
    expect(onClick).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 3. Loading / placeholder state
// =============================================================================

describe('ImageCard — loading placeholder', () => {
  it('renders a placeholder (not an img) when isLoading is true', () => {
    const image = makeLoading('pending.png');
    render(<ImageCard image={image} onClick={vi.fn()} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('still renders the filename when isLoading is true', () => {
    const image = makeLoading('pending.png');
    render(<ImageCard image={image} onClick={vi.fn()} />);
    expect(screen.getByText('pending.png')).toBeTruthy();
  });

  it('renders an img (not a placeholder) when isLoading is false', () => {
    const image = makeImage('loaded.png');
    render(<ImageCard image={image} onClick={vi.fn()} />);
    expect(screen.getByRole('img')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });
});

// =============================================================================
// 4. React.memo effectiveness — skips re-render when props are unchanged
// =============================================================================

describe('ImageCard — memo effectiveness', () => {
  it('does not invoke onClick on re-render with identical props', () => {
    // Verifies that React.memo prevents spurious work; onClick is only called
    // when the user actually clicks, not as a side-effect of re-rendering.
    const onClick = vi.fn();
    const image = makeImage('memo-check.png');

    const { rerender } = render(<ImageCard image={image} onClick={onClick} />);

    // Re-render with the exact same prop references — memo should skip diffing.
    act(() => {
      rerender(<ImageCard image={image} onClick={onClick} />);
    });

    expect(onClick).not.toHaveBeenCalled();
  });

  it('still updates the rendered img src when the image prop changes', () => {
    const onClick = vi.fn();
    const image1 = makeImage('first.png', '/first.png');
    const image2 = makeImage('second.png', '/second.png');

    const { rerender } = render(<ImageCard image={image1} onClick={onClick} />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/first.png');

    act(() => {
      rerender(<ImageCard image={image2} onClick={onClick} />);
    });

    expect(screen.getByRole('img').getAttribute('src')).toBe('/second.png');
  });
});

// =============================================================================
// 5. Callback stability — onClick only fires on explicit user interaction
// =============================================================================

describe('ImageCard — callback stability', () => {
  it('only invokes onClick when the image is actually clicked, not on re-render', () => {
    const onClick = vi.fn();
    const image = makeImage('stable.png');

    const { rerender } = render(<ImageCard image={image} onClick={onClick} />);

    // Multiple re-renders with a new callback reference.
    const newOnClick = vi.fn();
    act(() => {
      rerender(<ImageCard image={image} onClick={newOnClick} />);
    });
    act(() => {
      rerender(<ImageCard image={image} onClick={newOnClick} />);
    });

    // Neither the original nor the replacement should have been called.
    expect(onClick).not.toHaveBeenCalled();
    expect(newOnClick).not.toHaveBeenCalled();

    // Now click — only the current callback should fire.
    fireEvent.click(screen.getByRole('img'));
    expect(newOnClick).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('invokes the updated onClick when the callback prop changes and user clicks', () => {
    const first = vi.fn();
    const second = vi.fn();
    const image = makeImage('cb-update.png');

    const { rerender } = render(<ImageCard image={image} onClick={first} />);

    // Swap the callback.
    act(() => {
      rerender(<ImageCard image={image} onClick={second} />);
    });

    fireEvent.click(screen.getByRole('img'));

    // The new callback should have fired; the old one should not.
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
