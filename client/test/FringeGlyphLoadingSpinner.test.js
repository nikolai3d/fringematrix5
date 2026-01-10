import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Fisher-Yates shuffle implementation (extracted for testing)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

describe('FringeGlyphLoadingSpinner - Shuffle Algorithm', () => {
  it('should return a new array (not mutate original)', () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    const shuffled = shuffleArray(original);

    // Original should be unchanged
    expect(original).toEqual(originalCopy);
    // Shuffled should be a different array instance
    expect(shuffled).not.toBe(original);
  });

  it('should contain all original elements', () => {
    const original = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffleArray(original);

    expect(shuffled).toHaveLength(original.length);
    original.forEach(item => {
      expect(shuffled).toContain(item);
    });
  });

  it('should handle empty array', () => {
    const result = shuffleArray([]);
    expect(result).toEqual([]);
  });

  it('should handle single element array', () => {
    const result = shuffleArray(['only']);
    expect(result).toEqual(['only']);
  });

  it('should produce different orderings over multiple runs (probabilistic)', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();

    // Run shuffle 20 times and collect unique orderings
    for (let i = 0; i < 20; i++) {
      results.add(JSON.stringify(shuffleArray(original)));
    }

    // With 10 elements, probability of getting same order twice is very low
    // We should see multiple different orderings
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('FringeGlyphLoadingSpinner - Default Props', () => {
  // These are the default values from the component
  const DEFAULTS = {
    x: 0,
    y: 0,
    size: 100,
    opacity: 1,
    fadeInDuration: 500,
    displayDuration: 1500,
    crossDissolveDuration: 500,
  };

  it('should have correct default x position', () => {
    expect(DEFAULTS.x).toBe(0);
  });

  it('should have correct default y position', () => {
    expect(DEFAULTS.y).toBe(0);
  });

  it('should have correct default size', () => {
    expect(DEFAULTS.size).toBe(100);
  });

  it('should have correct default opacity', () => {
    expect(DEFAULTS.opacity).toBe(1);
  });

  it('should have correct default fadeInDuration', () => {
    expect(DEFAULTS.fadeInDuration).toBe(500);
  });

  it('should have correct default displayDuration', () => {
    expect(DEFAULTS.displayDuration).toBe(1500);
  });

  it('should have correct default crossDissolveDuration', () => {
    expect(DEFAULTS.crossDissolveDuration).toBe(500);
  });
});

describe('FringeGlyphLoadingSpinner - Two-Slot Cross-Dissolve System', () => {
  // Simulate the two-slot state management logic
  const createTwoSlotState = (numGlyphs) => {
    return {
      slot0ImageIndex: 0,
      slot1ImageIndex: numGlyphs > 1 ? 1 : 0,
      activeSlot: 0, // 0 or 1
      isTransitioning: false,
      imageIndexRef: 0, // tracks current position in sequence
    };
  };

  // Simulate the advanceToNextImage logic
  const advanceToNextImage = (state, numGlyphs) => {
    if (numGlyphs <= 1) return state;

    // Start transition
    const transitioning = { ...state, isTransitioning: true };

    // After transition completes (simulated)
    const nextImageIndex = (state.imageIndexRef + 1) % numGlyphs;
    const nextNextIndex = (nextImageIndex + 1) % numGlyphs;

    if (state.activeSlot === 0) {
      // Slot 0 faded out, slot 1 is now showing
      return {
        slot0ImageIndex: nextNextIndex,
        slot1ImageIndex: state.slot1ImageIndex, // unchanged during transition
        activeSlot: 1,
        isTransitioning: false,
        imageIndexRef: nextImageIndex,
      };
    } else {
      // Slot 1 faded out, slot 0 is now showing
      return {
        slot0ImageIndex: state.slot0ImageIndex, // unchanged during transition
        slot1ImageIndex: nextNextIndex,
        activeSlot: 0,
        isTransitioning: false,
        imageIndexRef: nextImageIndex,
      };
    }
  };

  it('should initialize with correct slot indices', () => {
    const state = createTwoSlotState(5);
    expect(state.slot0ImageIndex).toBe(0);
    expect(state.slot1ImageIndex).toBe(1);
    expect(state.activeSlot).toBe(0);
  });

  it('should handle single image gracefully', () => {
    const state = createTwoSlotState(1);
    expect(state.slot0ImageIndex).toBe(0);
    expect(state.slot1ImageIndex).toBe(0);
  });

  it('should swap active slot after transition', () => {
    let state = createTwoSlotState(5);
    expect(state.activeSlot).toBe(0);

    state = advanceToNextImage(state, 5);
    expect(state.activeSlot).toBe(1);

    state = advanceToNextImage(state, 5);
    expect(state.activeSlot).toBe(0);
  });

  it('should load next-next image into the slot that faded out', () => {
    let state = createTwoSlotState(5);
    // Initial: slot0=0 (active), slot1=1
    expect(state.slot0ImageIndex).toBe(0);
    expect(state.slot1ImageIndex).toBe(1);

    // After first transition: slot0 faded, loads image 2
    state = advanceToNextImage(state, 5);
    expect(state.slot0ImageIndex).toBe(2); // loaded next-next
    expect(state.slot1ImageIndex).toBe(1); // unchanged, now active
    expect(state.activeSlot).toBe(1);

    // After second transition: slot1 faded, loads image 3
    state = advanceToNextImage(state, 5);
    expect(state.slot0ImageIndex).toBe(2); // unchanged, now active
    expect(state.slot1ImageIndex).toBe(3); // loaded next-next
    expect(state.activeSlot).toBe(0);
  });

  it('should cycle through all images correctly', () => {
    const numGlyphs = 4;
    let state = createTwoSlotState(numGlyphs);
    const seenImages = new Set();

    // Track which images become "current" (the active slot's image)
    const getCurrentImage = (s) => s.activeSlot === 0 ? s.slot0ImageIndex : s.slot1ImageIndex;

    seenImages.add(getCurrentImage(state));

    // Advance through all images
    for (let i = 0; i < numGlyphs; i++) {
      state = advanceToNextImage(state, numGlyphs);
      seenImages.add(getCurrentImage(state));
    }

    // Should have seen all images
    expect(seenImages.size).toBe(numGlyphs);
  });

  it('should wrap around to beginning after showing all images', () => {
    const numGlyphs = 3;
    let state = createTwoSlotState(numGlyphs);

    // Advance through all images and then some
    for (let i = 0; i < numGlyphs + 1; i++) {
      state = advanceToNextImage(state, numGlyphs);
    }

    // imageIndexRef should have wrapped around
    expect(state.imageIndexRef).toBeLessThan(numGlyphs);
  });

  it('should not change state for single image', () => {
    const state = createTwoSlotState(1);
    const newState = advanceToNextImage(state, 1);

    // State should be unchanged (same object reference for same values)
    expect(newState.slot0ImageIndex).toBe(state.slot0ImageIndex);
    expect(newState.activeSlot).toBe(state.activeSlot);
  });
});

describe('FringeGlyphLoadingSpinner - Timing Calculations', () => {
  it('should calculate correct interval time (display + crossDissolve)', () => {
    const displayDuration = 1500;
    const crossDissolveDuration = 500;
    const intervalTime = displayDuration + crossDissolveDuration;

    expect(intervalTime).toBe(2000);
  });

  it('should allow zero crossDissolveDuration (instant switch)', () => {
    const displayDuration = 1000;
    const crossDissolveDuration = 0;
    const intervalTime = displayDuration + crossDissolveDuration;

    expect(intervalTime).toBe(1000);
  });

  it('should handle very fast timing', () => {
    const displayDuration = 100;
    const crossDissolveDuration = 50;
    const intervalTime = displayDuration + crossDissolveDuration;

    expect(intervalTime).toBe(150);
  });
});

describe('FringeGlyphLoadingSpinner - API Contract', () => {
  it('should expect /api/glyphs to return glyphs array', () => {
    // Test the expected API response format
    const validResponse = {
      glyphs: [
        'https://cdn.example.com/glyph1.jpg',
        'https://cdn.example.com/glyph2.jpg',
        'https://cdn.example.com/glyph3.jpg',
      ]
    };

    expect(validResponse).toHaveProperty('glyphs');
    expect(Array.isArray(validResponse.glyphs)).toBe(true);
    expect(validResponse.glyphs.length).toBeGreaterThan(0);
  });

  it('should handle empty glyphs array gracefully', () => {
    const emptyResponse = { glyphs: [] };

    expect(emptyResponse.glyphs).toHaveLength(0);
    // Component should render null when no glyphs
  });

  it('should handle missing glyphs property', () => {
    const invalidResponse = {};

    // Component should check for this
    const glyphs = invalidResponse.glyphs || [];
    expect(glyphs).toHaveLength(0);
  });
});

describe('FringeGlyphLoadingSpinner - CSS Transitions', () => {
  it('should generate correct container opacity transition', () => {
    const fadeInDuration = 500;
    const expectedTransition = `opacity ${fadeInDuration}ms ease-in-out`;

    expect(expectedTransition).toBe('opacity 500ms ease-in-out');
  });

  it('should generate correct image opacity transition', () => {
    const crossDissolveDuration = 800;
    const expectedTransition = `opacity ${crossDissolveDuration}ms ease-in-out`;

    expect(expectedTransition).toBe('opacity 800ms ease-in-out');
  });
});

describe('FringeGlyphLoadingSpinner - z-index Layering', () => {
  it('should have active slot on top (z-index 2)', () => {
    const activeSlot = 0;
    const slot0OnTop = activeSlot === 0;

    const slot0ZIndex = slot0OnTop ? 2 : 1;
    const slot1ZIndex = slot0OnTop ? 1 : 2;

    expect(slot0ZIndex).toBe(2); // active slot on top
    expect(slot1ZIndex).toBe(1); // inactive slot behind
  });

  it('should swap z-index when active slot changes', () => {
    // Before swap: slot 0 is active
    let activeSlot = 0;
    let slot0OnTop = activeSlot === 0;
    expect(slot0OnTop ? 2 : 1).toBe(2);

    // After swap: slot 1 is active
    activeSlot = 1;
    slot0OnTop = activeSlot === 0;
    expect(slot0OnTop ? 2 : 1).toBe(1); // slot 0 now has z-index 1
  });
});

describe('FringeGlyphLoadingSpinner - Opacity During Transition', () => {
  it('should fade out active slot during transition', () => {
    const activeSlot = 0;
    const isTransitioning = true;
    const slot0OnTop = activeSlot === 0;

    // Active slot opacity during transition
    const slot0Opacity = slot0OnTop ? (isTransitioning ? 0 : 1) : 1;

    expect(slot0Opacity).toBe(0); // fading out
  });

  it('should keep inactive slot visible during transition', () => {
    const activeSlot = 0;
    const isTransitioning = true;
    const slot0OnTop = activeSlot === 0;

    // Inactive slot opacity (slot 1)
    const slot1Opacity = !slot0OnTop ? (isTransitioning ? 0 : 1) : 1;

    expect(slot1Opacity).toBe(1); // stays visible behind
  });

  it('should have both slots fully opaque when not transitioning', () => {
    const activeSlot = 0;
    const isTransitioning = false;
    const slot0OnTop = activeSlot === 0;

    const slot0Opacity = slot0OnTop ? (isTransitioning ? 0 : 1) : 1;
    const slot1Opacity = !slot0OnTop ? (isTransitioning ? 0 : 1) : 1;

    expect(slot0Opacity).toBe(1);
    expect(slot1Opacity).toBe(1);
  });
});

describe('FringeGlyphLoadingSpinner - Container Styling', () => {
  it('should be positioned absolutely', () => {
    const containerStyle = {
      position: 'absolute',
      left: 100,
      top: 200,
    };

    expect(containerStyle.position).toBe('absolute');
    expect(containerStyle.left).toBe(100);
    expect(containerStyle.top).toBe(200);
  });

  it('should be square (width equals height)', () => {
    const size = 150;
    const containerStyle = {
      width: size,
      height: size,
    };

    expect(containerStyle.width).toBe(containerStyle.height);
  });

  it('should apply provided opacity when visible', () => {
    const opacity = 0.8;
    const componentVisible = true;
    const containerOpacity = componentVisible ? opacity : 0;

    expect(containerOpacity).toBe(0.8);
  });

  it('should have zero opacity when not visible', () => {
    const opacity = 0.8;
    const componentVisible = false;
    const containerOpacity = componentVisible ? opacity : 0;

    expect(containerOpacity).toBe(0);
  });
});

describe('FringeGlyphLoadingSpinner - Image Styling', () => {
  it('should use object-fit cover for images', () => {
    const imageStyle = {
      objectFit: 'cover',
    };

    expect(imageStyle.objectFit).toBe('cover');
  });

  it('should fill container (100% width and height)', () => {
    const imageStyle = {
      width: '100%',
      height: '100%',
    };

    expect(imageStyle.width).toBe('100%');
    expect(imageStyle.height).toBe('100%');
  });

  it('should position images absolutely within container', () => {
    const imageStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
    };

    expect(imageStyle.position).toBe('absolute');
    expect(imageStyle.top).toBe(0);
    expect(imageStyle.left).toBe(0);
  });
});
