import { useId, type ChangeEvent, type CSSProperties } from 'react';

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
 * Inline SVG for a magnifying glass with a minus sign (zoom out).
 * Drawn at 16x16 viewBox to match the icon size used by the buttons.
 */
function ZoomOutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

/**
 * Inline SVG for a magnifying glass with a plus sign (zoom in).
 * Drawn at 16x16 viewBox to match the icon size used by the buttons.
 */
function ZoomInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

/**
 * Stateless controlled slider for selecting a thumbnail size step.
 *
 * Renders a discrete range input with step=1, min=0, max=steps-1, plus a
 * compact "THUMBNAIL SIZE" label above the track. The label is
 * programmatically associated with the input via `htmlFor`/`id` so screen
 * readers announce the visible text and click-to-focus works.
 *
 * Magnifier buttons flank the slider: zoom-out (minus) on the left and
 * zoom-in (plus) on the right. Each click steps the index by one and is
 * disabled when already at the corresponding bound.
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

  const handleZoomOut = () => {
    if (value > 0) onChange(value - 1);
  };

  const handleZoomIn = () => {
    if (value < max) onChange(value + 1);
  };

  // Percentage of the track that the accent fill covers (0..100). When
  // `max === 0` the slider is disabled, so the fill is meaningless — we
  // still emit 0 so the CSS variable is always defined.
  const fillPct = max > 0 ? (value / max) * 100 : 0;
  const trackStyle = {
    '--thumbnail-slider-fill': `${fillPct}%`,
  } as CSSProperties;

  // Render one tick mark per step. The track and ticks share the same
  // horizontal padding so ticks align under the thumb at each step.
  const tickCount = Math.max(steps, 0);

  return (
    <div className="thumbnail-size-slider">
      <label htmlFor={inputId} className="thumbnail-size-slider-label">
        THUMBNAIL SIZE
      </label>
      <div className="thumbnail-size-slider-controls">
        <button
          type="button"
          className="thumbnail-size-slider-zoom-btn"
          aria-label="Zoom out"
          onClick={handleZoomOut}
          disabled={disabled || value <= 0}
        >
          <ZoomOutIcon />
        </button>
        <div className="thumbnail-size-slider-track-wrap">
          <input
            id={inputId}
            type="range"
            min={0}
            max={max}
            step={1}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            style={trackStyle}
          />
          <div className="thumbnail-size-slider-ticks" aria-hidden="true">
            {Array.from({ length: tickCount }, (_, i) => (
              <span className="thumbnail-size-slider-tick" key={i} />
            ))}
          </div>
        </div>
        <button
          type="button"
          className="thumbnail-size-slider-zoom-btn"
          aria-label="Zoom in"
          onClick={handleZoomIn}
          disabled={disabled || value >= max}
        >
          <ZoomInIcon />
        </button>
      </div>
    </div>
  );
}
