import { useId, type ChangeEvent } from 'react';

interface ThumbnailSizeSliderProps {
  /** Current step index (0-based, controlled). */
  value: number;
  /**
   * Total number of discrete size steps.
   *
   * Conceptually expected to be >= 1. The component tolerates `steps <= 1`
   * by rendering the input with `max=0` and `disabled`, so there is nothing
   * to slide. Consumers should pass `steps >= 2` for a usable slider.
   */
  steps: number;
  /** Called with the new step index whenever the user changes the slider. */
  onChange: (index: number) => void;
}

/**
 * Stateless controlled slider for selecting a thumbnail size step.
 *
 * Renders a discrete range input with step=1, min=0, max=steps-1, plus a
 * compact "THUMBNAIL SIZE" label above the track. The label is
 * programmatically associated with the input via `htmlFor`/`id` so screen
 * readers announce the visible text and click-to-focus works.
 *
 * Accessibility: this component relies on the native semantics of
 * `<input type="range">` for `aria-valuenow`/`aria-valuemin`/`aria-valuemax`;
 * those attributes are intentionally not set manually because the browser
 * derives them from `value`/`min`/`max`.
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
  const inputId = useId();
  const max = Math.max(0, steps - 1);
  const disabled = steps <= 1;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  return (
    <div className="thumbnail-size-slider">
      <label htmlFor={inputId} className="thumbnail-size-slider-label">
        THUMBNAIL SIZE
      </label>
      <input
        id={inputId}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
