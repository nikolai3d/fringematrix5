import { useEffect, useState, useCallback } from 'react';

interface LegacyLoadingScreenProps {
  campaignCount: number | null;
  imageCount: number | null;
  isDataReady: boolean;
  onComplete: () => void;
}

/**
 * Legacy Loading Screen
 * Simple centered "Fringe Matrix 5 Loading..." message with animated dots
 * This was the original loading screen style
 */
export default function LegacyLoadingScreen({
  campaignCount: _campaignCount,
  imageCount: _imageCount,
  isDataReady,
  onComplete,
}: LegacyLoadingScreenProps) {
  const [dots, setDots] = useState('');
  const [canSkip, setCanSkip] = useState(false);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

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
      className="loading-screen legacy"
      role="dialog"
      aria-modal={true}
      aria-label="Loading"
      onClick={canSkip ? handleSkip : undefined}
    >
      <div className="legacy-loading-content">
        <div className="legacy-loading-text">
          Fringe Matrix 5 Loading{dots}
        </div>
        {canSkip && (
          <div className="legacy-skip-hint">
            Press ENTER, SPACE, or click anywhere to continue...
          </div>
        )}
      </div>
    </div>
  );
}
