import { useEffect } from 'react';
import FringeGlyphLoadingSpinner from './FringeGlyphLoadingSpinner';
import { LOADING_SCREEN_AUTO_FADE_DELAY_MS } from '../config/loadingScreen';

interface GlyphsLoadingScreenProps {
  campaignCount: number | null;
  imageCount: number | null;
  isDataReady: boolean;
  onComplete: () => void;
}

/**
 * Glyphs Loading Screen
 * Features Fringe glyphs rotating in the center on a black background
 * Minimalist and visually striking - auto-fades when loading completes
 */
export default function GlyphsLoadingScreen({
  campaignCount: _campaignCount,
  imageCount: _imageCount,
  isDataReady,
  onComplete,
}: GlyphsLoadingScreenProps) {
  // Auto-complete when data is ready after configured delay
  useEffect(() => {
    if (isDataReady) {
      const timer = setTimeout(() => {
        onComplete();
      }, LOADING_SCREEN_AUTO_FADE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isDataReady, onComplete]);

  return (
    <div
      className="loading-screen glyphs"
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
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
      </div>
    </div>
  );
}
