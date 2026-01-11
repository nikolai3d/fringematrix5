import { useEffect, useState, useCallback } from 'react';
import FringeGlyphLoadingSpinner from './FringeGlyphLoadingSpinner';

interface GlyphsLoadingScreenProps {
  campaignCount: number | null;
  imageCount: number | null;
  isDataReady: boolean;
  onComplete: () => void;
}

/**
 * Glyphs Loading Screen
 * Features Fringe glyphs rotating in the center on a black background
 * Minimalist and visually striking
 */
export default function GlyphsLoadingScreen({
  campaignCount: _campaignCount,
  imageCount: _imageCount,
  isDataReady,
  onComplete,
}: GlyphsLoadingScreenProps) {
  const [canSkip, setCanSkip] = useState(false);

  // Enable skip when data is ready
  useEffect(() => {
    if (isDataReady) {
      const timer = setTimeout(() => {
        setCanSkip(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDataReady]);

  // Auto-complete when data is ready
  useEffect(() => {
    if (isDataReady && canSkip) {
      const timer = setTimeout(() => {
        onComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isDataReady, canSkip, onComplete]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (canSkip) {
      onComplete();
    }
  }, [canSkip, onComplete]);

  // Skip on click or key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (canSkip && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
        e.preventDefault();
        handleSkip();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canSkip, handleSkip]);

  return (
    <div
      className="loading-screen glyphs"
      role="dialog"
      aria-modal={true}
      aria-label="Loading"
      onClick={canSkip ? handleSkip : undefined}
    >
      <div className="glyphs-loading-container">
        {/* Center the glyph spinner */}
        <div className="glyphs-spinner-wrapper">
          <FringeGlyphLoadingSpinner
            x={0}
            y={0}
            size={200}
            opacity={1}
            borderRadius={0}
            fadeInDuration={500}
            displayDuration={1200}
            crossDissolveDuration={600}
          />
        </div>
        {canSkip && (
          <div className="glyphs-skip-hint">
            Press ENTER, SPACE, or click anywhere to continue...
          </div>
        )}
      </div>
    </div>
  );
}
