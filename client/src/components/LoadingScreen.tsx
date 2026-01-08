import { useState, useEffect, useCallback } from 'react';

export interface LoadingStep {
  text: string;
  delay: number; // ms to wait before showing this step
  typeSpeed?: number; // ms per character (default 30)
}

interface LoadingScreenProps {
  campaignCount: number | null;
  imageCount: number | null;
  isDataReady: boolean;
  onComplete: () => void;
}

export default function LoadingScreen({
  campaignCount,
  imageCount,
  isDataReady,
  onComplete,
}: LoadingScreenProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [canSkip, setCanSkip] = useState(false);
  const [sequenceComplete, setSequenceComplete] = useState(false);

  // Generate loading steps based on available data
  const getLoadingSteps = useCallback((): LoadingStep[] => {
    const steps: LoadingStep[] = [
      { text: '> FRINGE DIVISION TERMINAL v5.0', delay: 200, typeSpeed: 15 },
      { text: '> Initializing secure connection...', delay: 400, typeSpeed: 25 },
      { text: '> [OK] Connection established', delay: 600, typeSpeed: 20 },
      { text: '', delay: 200 }, // Empty line
      { text: '> Accessing Fringe Division Archives (2012-2013)...', delay: 500, typeSpeed: 30 },
      { text: '> [OK] Archive database online', delay: 400, typeSpeed: 20 },
    ];

    // Add campaign info if available
    if (campaignCount !== null) {
      steps.push({ text: '', delay: 150 });
      steps.push({
        text: `> ${campaignCount} social media campaigns found`,
        delay: 300,
        typeSpeed: 25,
      });
      steps.push({ text: '> Campaign classification: FANDOM AVATARS', delay: 250, typeSpeed: 25 });
    }

    // Add image info if available
    if (imageCount !== null) {
      steps.push({ text: '', delay: 150 });
      steps.push({
        text: `> ${imageCount} image files located in active campaign`,
        delay: 300,
        typeSpeed: 25,
      });
      steps.push({ text: '> File format: FRINGE AVATAR GRAPHICS', delay: 250, typeSpeed: 25 });
    }

    // Final sequence
    steps.push({ text: '', delay: 300 });
    steps.push({ text: '> Verifying user credentials...', delay: 500, typeSpeed: 30 });
    steps.push({ text: '> [OK] CLEARANCE LEVEL: PUBLIC ACCESS', delay: 400, typeSpeed: 20 });
    steps.push({ text: '', delay: 200 });
    steps.push({ text: '> Requesting archive access...', delay: 600, typeSpeed: 30 });
    steps.push({ text: '> [OK] ACCESS GRANTED', delay: 500, typeSpeed: 15 });
    steps.push({ text: '', delay: 200 });
    steps.push({ text: '> Loading Fringe Matrix Interface...', delay: 400, typeSpeed: 25 });

    return steps;
  }, [campaignCount, imageCount]);

  const [steps, setSteps] = useState<LoadingStep[]>([]);

  // Update steps when data becomes available and reset typing state
  useEffect(() => {
    const newSteps = getLoadingSteps();
    setSteps(newSteps);
    // Restart the typing animation whenever the steps sequence changes
    setVisibleLines([]);
    setCurrentLineIndex(0);
    setCurrentCharIndex(0);
    setIsTyping(false);
    setSequenceComplete(false);
  }, [getLoadingSteps]);

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Typing effect
  useEffect(() => {
    if (steps.length === 0 || currentLineIndex >= steps.length) {
      if (steps.length > 0 && currentLineIndex >= steps.length) {
        setSequenceComplete(true);
      }
      return;
    }

    const currentStep = steps[currentLineIndex];
    const targetText = currentStep.text;
    const typeSpeed = currentStep.typeSpeed || 30;

    // If this is an empty line, just add it and move on
    if (targetText === '') {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [...prev, '']);
        setCurrentLineIndex((prev) => prev + 1);
        setCurrentCharIndex(0);
      }, currentStep.delay);
      return () => clearTimeout(timer);
    }

    // Start typing after delay
    if (currentCharIndex === 0 && !isTyping) {
      const timer = setTimeout(() => {
        setIsTyping(true);
      }, currentStep.delay);
      return () => clearTimeout(timer);
    }

    // Type characters
    if (isTyping && currentCharIndex < targetText.length) {
      const timer = setTimeout(() => {
        setCurrentCharIndex((prev) => prev + 1);
      }, typeSpeed);
      return () => clearTimeout(timer);
    }

    // Move to next line when done typing
    if (isTyping && currentCharIndex >= targetText.length) {
      setVisibleLines((prev) => [...prev, targetText]);
      setCurrentLineIndex((prev) => prev + 1);
      setCurrentCharIndex(0);
      setIsTyping(false);
    }
  }, [steps, currentLineIndex, currentCharIndex, isTyping]);

  // Enable skip when data is ready
  useEffect(() => {
    if (isDataReady) {
      // Small delay before allowing skip
      const timer = setTimeout(() => {
        setCanSkip(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDataReady]);

  // Auto-complete when sequence finishes and data is ready
  useEffect(() => {
    if (sequenceComplete && isDataReady) {
      const timer = setTimeout(() => {
        onComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [sequenceComplete, isDataReady, onComplete]);

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

  // Get current typing line text
  const currentTypingText =
    isTyping && currentLineIndex < steps.length
      ? steps[currentLineIndex].text.slice(0, currentCharIndex)
      : '';

  return (
    <div
      className="loading-screen"
      role="dialog"
      aria-modal={true}
      aria-label="Loading"
      onClick={canSkip ? handleSkip : undefined}
    >
      <div className="loading-terminal">
        <div className="terminal-header">
          <span className="terminal-title">FRINGE DIVISION // SECURE TERMINAL</span>
          <span className="terminal-status">CONNECTED</span>
        </div>
        <div className="terminal-body">
          <div className="terminal-scanlines"></div>
          <div className="terminal-content" aria-live="polite" aria-atomic="false">
            {visibleLines.map((line, index) => (
              <div key={`${index}-${line}`} className={`terminal-line ${line === '' ? 'empty' : ''}`}>
                {line}
              </div>
            ))}
            {isTyping && (
              <div className="terminal-line typing">
                {currentTypingText}
                <span className={`terminal-cursor ${showCursor ? 'visible' : ''}`}>_</span>
              </div>
            )}
            {!isTyping && currentLineIndex < steps.length && (
              <div className="terminal-line">
                <span className={`terminal-cursor ${showCursor ? 'visible' : ''}`}>_</span>
              </div>
            )}
          </div>
        </div>
        {canSkip && (
          <div className="terminal-skip">
            Press ENTER, SPACE, or click anywhere to continue...
          </div>
        )}
      </div>
    </div>
  );
}
