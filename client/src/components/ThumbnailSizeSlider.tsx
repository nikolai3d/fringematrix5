import type { ChangeEvent } from 'react';

interface ThumbnailSizeSliderProps {
  /** Current step index (0-based, controlled). */
  value: number;
  /** Total number of discrete size steps. Must be >= 1. */
  steps: number;
  /** Called with the new step index whenever the user changes the slider. */
  onChange: (index: number) => void;
}

/**
 * Stateless controlled slider for selecting a thumbnail size step.
 *
 * Renders a discrete range input with step=1, min=0, max=steps-1, plus a
 * compact "THUMBNAIL SIZE" label above the track. The input carries
 * ARIA attributes so assistive technology announces the current step.
 *
 * When the document root has the `reduce-motion` class, CSS transitions on
 * the slider thumb are suppressed (see styles.css for the scoped rules).
 *
 * Note: the consumer owns clamping/bounds via the controlled `value` prop.
 * The native range input already constrains its emitted value to [min, max],
 * so no extra clamping happens here.
 */
export default function ThumbnailSizeSlider({
  value,
  steps,
  onChange,
}: ThumbnailSizeSliderProps) {
  const max = Math.max(0, steps - 1);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  return (
    <div className="thumbnail-size-slider">
      <div className="thumbnail-size-slider-label">THUMBNAIL SIZE</div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={handleChange}
        aria-label="Thumbnail size"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  );
}
