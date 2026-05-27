import React from 'react';

/**
 * Generic prev/current/next switcher used by the top and bottom navbars.
 *
 * Renders three elements:
 *   - A left arrow button that calls `onPrev`.
 *   - A current-label div (with optional `data-testid` for E2E hooks).
 *   - A right arrow button that calls `onNext`.
 *
 * Used in two modes (extracted from `App.tsx` in fringematrix5-y6kl):
 *   - Campaign switcher (gallery route): cycles through campaigns.
 *   - Artist switcher (author-detail route): cycles through artists.
 *
 * Each mode is rendered twice (top header + bottom footer) — the only
 * difference between top/bottom is the `data-testid` suffix.
 *
 * Pure refactor: no behavior change vs. the inline JSX it replaces.
 */
interface NavSwitcherProps {
  label: string;
  title?: string;
  testId?: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

function NavSwitcher({
  label,
  title,
  testId,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  disabled = false,
}: NavSwitcherProps) {
  return (
    <>
      <button
        className="nav-arrow"
        aria-label={prevLabel}
        onClick={onPrev}
        disabled={disabled}
      >◀</button>
      <div
        className="current-campaign"
        data-testid={testId}
        title={title}
      >
        {label}
      </div>
      <button
        className="nav-arrow"
        aria-label={nextLabel}
        onClick={onNext}
        disabled={disabled}
      >▶</button>
    </>
  );
}

export default React.memo(NavSwitcher);
