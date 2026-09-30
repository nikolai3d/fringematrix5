import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import LegacyLoadingScreen from '../../src/components/LegacyLoadingScreen';
import { LOADING_SCREEN_AUTO_FADE_DELAY_MS } from '../../src/config/loadingScreen';

const SKIP_ENABLE_DELAY_MS = 500;

function renderLegacy(isDataReady: boolean, onComplete = vi.fn()) {
  const utils = render(
    <LegacyLoadingScreen campaignCount={3} imageCount={10} isDataReady={isDataReady} onComplete={onComplete} />,
  );
  return { ...utils, onComplete };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LegacyLoadingScreen', () => {
  it('renders a modal loading dialog with the loading text', () => {
    renderLegacy(false);
    const dialog = screen.getByRole('dialog', { name: 'Loading' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('loading-screen', 'legacy');
    expect(screen.getByText('Fringe Matrix 5 Loading')).toBeInTheDocument();
  });

  it('animates dots every 400ms and wraps after three', () => {
    renderLegacy(false);
    const text = () => document.querySelector('.legacy-loading-text')!.textContent;
    expect(text()).toBe('Fringe Matrix 5 Loading');
    advance(400);
    expect(text()).toBe('Fringe Matrix 5 Loading.');
    advance(400);
    expect(text()).toBe('Fringe Matrix 5 Loading..');
    advance(400);
    expect(text()).toBe('Fringe Matrix 5 Loading...');
    advance(400);
    expect(text()).toBe('Fringe Matrix 5 Loading');
  });

  it('does not show a skip hint or allow skipping while data is not ready', () => {
    const { onComplete } = renderLegacy(false);
    advance(5000);
    expect(screen.queryByText(/Press ENTER/)).toBeNull();
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows the skip hint 500ms after data becomes ready', () => {
    renderLegacy(true);
    expect(screen.queryByText(/Press ENTER/)).toBeNull();
    advance(SKIP_ENABLE_DELAY_MS - 1);
    expect(screen.queryByText(/Press ENTER/)).toBeNull();
    advance(1);
    expect(screen.getByText(/Press ENTER, SPACE, or click anywhere/)).toBeInTheDocument();
  });

  it('ignores Enter before the skip delay has elapsed', () => {
    const { onComplete } = renderLegacy(true);
    advance(100);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it.each(['Enter', ' ', 'Escape'])('skips via "%s" key once skippable', (key) => {
    const { onComplete } = renderLegacy(true);
    advance(SKIP_ENABLE_DELAY_MS);
    const ev = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
    document.dispatchEvent(ev);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('ignores unrelated keys', () => {
    const { onComplete } = renderLegacy(true);
    advance(SKIP_ENABLE_DELAY_MS);
    fireEvent.keyDown(document, { key: 'a' });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('skips on click once skippable', () => {
    const { onComplete } = renderLegacy(true);
    advance(SKIP_ENABLE_DELAY_MS);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('auto-completes after the configured fade delay once skippable', () => {
    const { onComplete } = renderLegacy(true);
    advance(SKIP_ENABLE_DELAY_MS);
    expect(onComplete).not.toHaveBeenCalled();
    advance(LOADING_SCREEN_AUTO_FADE_DELAY_MS);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('enables skip when isDataReady flips to true after mount', () => {
    const onComplete = vi.fn();
    const { rerender } = renderLegacy(false, onComplete);
    advance(2000);
    rerender(<LegacyLoadingScreen campaignCount={3} imageCount={10} isDataReady onComplete={onComplete} />);
    advance(SKIP_ENABLE_DELAY_MS);
    fireEvent.keyDown(document, { key: ' ' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('clears timers and the keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { onComplete, unmount } = renderLegacy(true);
    advance(SKIP_ENABLE_DELAY_MS);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.keyDown(document, { key: 'Enter' });
    advance(10000);
    expect(onComplete).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
