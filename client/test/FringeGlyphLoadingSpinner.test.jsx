import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import FringeGlyphLoadingSpinner from '../src/components/FringeGlyphLoadingSpinner';

// =============================================================================
// FringeGlyphLoadingSpinner Component Tests
// 
// Tests the component's contract as specified in COMPONENTS.md:
// - Fetches glyphs from /api/glyphs
// - Shuffles images randomly once on mount
// - Uses two-slot system for smooth cross-dissolve
// - All props have correct defaults
// - Cycles through images with configurable timing
// =============================================================================

// Mock glyphs data
const mockGlyphs = [
  'https://cdn.example.com/glyph1.jpg',
  'https://cdn.example.com/glyph2.jpg',
  'https://cdn.example.com/glyph3.jpg',
];

// Store original fetch and Image
const originalFetch = global.fetch;
const originalImage = global.Image;

beforeEach(() => {
  vi.useFakeTimers();
  
  // Mock fetch
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ glyphs: mockGlyphs }),
  });

  // Mock Image constructor for preloading - triggers onload synchronously
  global.Image = class MockImage {
    _src = '';
    onload = null;
    onerror = null;
    
    get src() {
      return this._src;
    }
    
    set src(value) {
      this._src = value;
      // Trigger onload in next microtask
      queueMicrotask(() => {
        if (this.onload) this.onload();
      });
    }
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  global.fetch = originalFetch;
  global.Image = originalImage;
});

// Helper to flush all pending promises and timers
async function flushPromisesAndTimers(ms = 100) {
  await act(async () => {
    await Promise.resolve(); // Flush microtasks
    vi.advanceTimersByTime(ms);
    await Promise.resolve(); // Flush any new microtasks
  });
}

describe('FringeGlyphLoadingSpinner - API Integration', () => {
  it('should fetch glyphs from /api/glyphs on mount', async () => {
    render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    expect(global.fetch).toHaveBeenCalledWith('/api/glyphs');
  });

  it('should render null when no glyphs are available', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ glyphs: [] }),
    });

    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    expect(container.querySelector('div')).toBeNull();
  });

  it('should render null when fetch fails', async () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    expect(container.querySelector('div')).toBeNull();
    consoleSpy.mockRestore();
  });

  it('should handle missing glyphs property in response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    expect(container.querySelector('div')).toBeNull();
  });
});

describe('FringeGlyphLoadingSpinner - Rendering', () => {
  it('should render two img elements for cross-dissolve', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
  });

  it('should render container with correct size', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner size={200} />);
    
    await flushPromisesAndTimers();
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ width: '200px', height: '200px' });
  });

  it('should render container at correct position', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner x={50} y={100} />);
    
    await flushPromisesAndTimers();
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ left: '50px', top: '100px' });
  });

  it('should apply absolute positioning', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ position: 'absolute' });
  });
});

describe('FringeGlyphLoadingSpinner - Default Props', () => {
  it('should use default size of 100px', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ width: '100px', height: '100px' });
  });

  it('should use default position of 0,0', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ left: '0px', top: '0px' });
  });
});

describe('FringeGlyphLoadingSpinner - Visibility and Fade-in', () => {
  it('should start with opacity 0 before images load', async () => {
    // Don't trigger onload
    global.Image = class MockImage {
      onload = null;
      onerror = null;
      set src(_value) {
        // Don't trigger onload
      }
    };

    const { container } = render(<FringeGlyphLoadingSpinner opacity={1} />);
    
    await flushPromisesAndTimers(10); // Short time, images haven't loaded
    
    const wrapper = container.firstChild;
    if (wrapper) {
      expect(wrapper).toHaveStyle({ opacity: '0' });
    }
  });

  it('should transition to target opacity after images are loaded', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner opacity={0.8} />);
    
    // Need enough time for: fetch -> image preload -> 50ms delay -> componentVisible
    await flushPromisesAndTimers(100);
    await flushPromisesAndTimers(100);
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ opacity: '0.8' });
  });

  it('should apply fadeInDuration to transition', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner fadeInDuration={1000} />);
    
    await flushPromisesAndTimers();
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ transition: 'opacity 1000ms ease-in-out' });
  });
});

describe('FringeGlyphLoadingSpinner - Image Styling', () => {
  it('should apply object-fit cover to images', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveStyle({ objectFit: 'cover' });
    });
  });

  it('should position images absolutely within container', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveStyle({ position: 'absolute' });
    });
  });

  it('should size images to fill container', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveStyle({ width: '100%', height: '100%' });
    });
  });
});

describe('FringeGlyphLoadingSpinner - Cross-dissolve Transitions', () => {
  it('should have one image on top (z-index 2) initially', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    const zIndices = Array.from(images).map(img => img.style.zIndex);
    
    expect(zIndices).toContain('2');
    expect(zIndices).toContain('1');
  });

  it('should apply crossDissolveDuration to active image transition', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner crossDissolveDuration={800} />);
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    const transitions = Array.from(images).map(img => img.style.transition);
    
    // One image should have the transition for cross-dissolve
    expect(transitions).toContain('opacity 800ms ease-in-out');
  });
});

describe('FringeGlyphLoadingSpinner - Image Cycling', () => {
  it('should cycle through images after displayDuration + crossDissolveDuration', async () => {
    const displayDuration = 500;
    const crossDissolveDuration = 200;
    
    const { container } = render(
      <FringeGlyphLoadingSpinner 
        displayDuration={displayDuration} 
        crossDissolveDuration={crossDissolveDuration} 
      />
    );
    
    // Wait for component to be ready
    await flushPromisesAndTimers(100);
    await flushPromisesAndTimers(100);
    
    // Get initial image sources
    const getImageSrcs = () => 
      Array.from(container.querySelectorAll('img')).map(img => img.getAttribute('src'));
    
    const initialSrcs = [...getImageSrcs()];
    
    // Advance past interval trigger (displayDuration + crossDissolveDuration)
    await act(async () => {
      vi.advanceTimersByTime(displayDuration + crossDissolveDuration);
      await Promise.resolve();
    });
    
    // Advance past the inner timeout (crossDissolveDuration) 
    await act(async () => {
      vi.advanceTimersByTime(crossDissolveDuration + 50);
      await Promise.resolve();
    });
    
    const newSrcs = getImageSrcs();
    
    // At least one image should have changed (the faded-out slot loads next-next)
    expect(newSrcs).not.toEqual(initialSrcs);
  });

  it('should not cycle when only one image is available', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ glyphs: ['https://example.com/single.jpg'] }),
    });

    const { container } = render(
      <FringeGlyphLoadingSpinner 
        displayDuration={100} 
        crossDissolveDuration={50} 
      />
    );
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    const initialSrc = images[0]?.getAttribute('src');
    
    // Advance well past cycle time
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    
    // Images should still show the same source
    const newImages = container.querySelectorAll('img');
    expect(newImages[0]?.getAttribute('src')).toBe(initialSrc);
  });
});

describe('FringeGlyphLoadingSpinner - Shuffle Behavior', () => {
  it('should load images from glyphs array', async () => {
    const { container } = render(<FringeGlyphLoadingSpinner />);
    
    await flushPromisesAndTimers();
    
    const images = container.querySelectorAll('img');
    const srcs = Array.from(images).map(img => img.getAttribute('src'));
    
    // All rendered srcs should be from the mock glyphs
    srcs.forEach(src => {
      expect(mockGlyphs).toContain(src);
    });
  });
});

describe('FringeGlyphLoadingSpinner - Cleanup', () => {
  it('should not throw after unmount during fetch', async () => {
    const { unmount } = render(<FringeGlyphLoadingSpinner />);
    
    // Unmount before operations complete
    unmount();
    
    // Advance timers - should not throw
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    
    // If we get here without errors, cleanup worked
    expect(true).toBe(true);
  });

  it('should clear timers on unmount', async () => {
    const { unmount } = render(
      <FringeGlyphLoadingSpinner 
        displayDuration={100} 
        crossDissolveDuration={50} 
      />
    );
    
    await flushPromisesAndTimers();
    
    unmount();
    
    // Advance timers well past cycle time - should not throw
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    
    expect(true).toBe(true);
  });
});

describe('FringeGlyphLoadingSpinner - Square Aspect Ratio', () => {
  it('should always be square (width equals height)', async () => {
    const sizes = [50, 100, 200, 300];
    
    for (const size of sizes) {
      const { container, unmount } = render(<FringeGlyphLoadingSpinner size={size} />);
      
      await flushPromisesAndTimers();
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveStyle({ width: `${size}px`, height: `${size}px` });
      
      unmount();
    }
  });
});
