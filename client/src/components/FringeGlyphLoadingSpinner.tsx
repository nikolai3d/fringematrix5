import { useState, useEffect, useRef, useCallback } from 'react';

export interface FringeGlyphLoadingSpinnerProps {
  /** X position in pixels */
  x?: number;
  /** Y position in pixels */
  y?: number;
  /** Width and height in pixels (component is always square) */
  size?: number;
  /** Overall component opacity (0-1) */
  opacity?: number;
  /** Duration of component fade-in in milliseconds */
  fadeInDuration?: number;
  /** Duration each image is displayed in milliseconds */
  displayDuration?: number;
  /** Duration of cross-dissolve between images in milliseconds */
  crossDissolveDuration?: number;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function FringeGlyphLoadingSpinner({
  x = 0,
  y = 0,
  size = 100,
  opacity = 1,
  fadeInDuration = 500,
  displayDuration = 1500,
  crossDissolveDuration = 500,
}: FringeGlyphLoadingSpinnerProps) {
  const [glyphs, setGlyphs] = useState<string[]>([]);
  const [componentVisible, setComponentVisible] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  // Two-slot system for smooth cross-dissolve
  // Each slot holds an image index, and we alternate which slot is "on top"
  const [slot0ImageIndex, setSlot0ImageIndex] = useState(0);
  const [slot1ImageIndex, setSlot1ImageIndex] = useState(1);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0); // which slot is currently on top
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const imageIndexRef = useRef(0); // tracks current position in sequence

  // Fetch glyphs on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchGlyphs() {
      try {
        const response = await fetch('/api/glyphs');
        if (!response.ok) throw new Error('Failed to fetch glyphs');
        const data = await response.json();
        
        if (!cancelled && data.glyphs && data.glyphs.length > 0) {
          const shuffled = shuffleArray(data.glyphs);
          setGlyphs(shuffled);
          setSlot0ImageIndex(0);
          setSlot1ImageIndex(shuffled.length > 1 ? 1 : 0);
          setActiveSlot(0);
          imageIndexRef.current = 0;
        }
      } catch (error) {
        console.error('Error fetching glyphs:', error);
      }
    }

    fetchGlyphs();
    return () => { cancelled = true; };
  }, []);

  // Preload images
  useEffect(() => {
    if (glyphs.length === 0) return;

    let mounted = true;
    let loadedCount = 0;
    const totalImages = glyphs.length;

    glyphs.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (mounted && loadedCount === totalImages) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (mounted && loadedCount === totalImages) {
          setImagesLoaded(true);
        }
      };
      img.src = src;
    });

    return () => { mounted = false; };
  }, [glyphs]);

  // Trigger component fade-in after images loaded
  useEffect(() => {
    if (imagesLoaded) {
      const timer = window.setTimeout(() => {
        setComponentVisible(true);
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [imagesLoaded]);

  // Image cycling logic with proper two-slot cross-dissolve
  const advanceToNextImage = useCallback(() => {
    if (glyphs.length <= 1) return;

    // Clear any pending timeout to prevent orphaned callbacks
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Start the cross-dissolve: active slot fades out
    setIsTransitioning(true);

    // After the cross-dissolve completes
    timerRef.current = window.setTimeout(() => {
      // Move to next image in sequence
      imageIndexRef.current = (imageIndexRef.current + 1) % glyphs.length;
      const nextNextIndex = (imageIndexRef.current + 1) % glyphs.length;
      
      // The slot that just faded out needs to load the next-next image
      // Then we swap which slot is active
      if (activeSlot === 0) {
        // Slot 0 faded out, slot 1 is now showing
        // Load next-next image into slot 0 (for the subsequent transition)
        setSlot0ImageIndex(nextNextIndex);
        setActiveSlot(1);
      } else {
        // Slot 1 faded out, slot 0 is now showing
        // Load next-next image into slot 1
        setSlot1ImageIndex(nextNextIndex);
        setActiveSlot(0);
      }
      
      setIsTransitioning(false);
    }, crossDissolveDuration);
  }, [glyphs.length, crossDissolveDuration, activeSlot]);

  // Main display timer
  useEffect(() => {
    if (!componentVisible || glyphs.length <= 1) return;

    const intervalTime = displayDuration + crossDissolveDuration;
    const interval = window.setInterval(advanceToNextImage, intervalTime);

    return () => {
      window.clearInterval(interval);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [componentVisible, glyphs.length, displayDuration, crossDissolveDuration, advanceToNextImage]);

  if (glyphs.length === 0) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: size,
    height: size,
    opacity: componentVisible ? opacity : 0,
    transition: `opacity ${fadeInDuration}ms ease-in-out`,
    overflow: 'hidden',
    borderRadius: '8px',
  };

  const imageStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  // Determine which slot is on top and their opacities
  const slot0OnTop = activeSlot === 0;
  const slot0Opacity = slot0OnTop ? (isTransitioning ? 0 : 1) : 1;
  const slot1Opacity = !slot0OnTop ? (isTransitioning ? 0 : 1) : 1;

  return (
    <div style={containerStyle}>
      {/* Slot 0 */}
      <img
        src={glyphs[slot0ImageIndex]}
        alt=""
        style={{
          ...imageStyle,
          opacity: slot0Opacity,
          zIndex: slot0OnTop ? 2 : 1,
          transition: slot0OnTop ? `opacity ${crossDissolveDuration}ms ease-in-out` : 'none',
        }}
      />
      {/* Slot 1 */}
      <img
        src={glyphs[slot1ImageIndex]}
        alt=""
        style={{
          ...imageStyle,
          opacity: slot1Opacity,
          zIndex: slot0OnTop ? 1 : 2,
          transition: !slot0OnTop ? `opacity ${crossDissolveDuration}ms ease-in-out` : 'none',
        }}
      />
    </div>
  );
}
