import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import TerminalLoadingScreen from '../../src/components/TerminalLoadingScreen';
import { LOADING_SCREEN_AUTO_FADE_DELAY_MS } from '../../src/config/loadingScreen';

const SKIP_ENABLE_DELAY_MS = 500;

type Props = React.ComponentProps<typeof TerminalLoadingScreen>;

function renderTerminal(overrides: Partial<Props> = {}) {
  const props: Props = {
    campaignCount: null,
    imageCount: null,
    isDataReady: false,
    onComplete: vi.fn(),
    ...overrides,
  };
  const utils = render(<TerminalLoadingScreen {...props} />);
  return { ...utils, props };
}

/**
 * Each typing step schedules its next timer only after React commits the
 * previous state update, so advance in small act()-wrapped slices rather than
 * one big jump (and never runAllTimers — the cursor blink interval is infinite).
 */
function advance(ms: number, step = 10) {
  for (let t = 0; t < ms; t += step) {
    act(() => {
      vi.advanceTimersByTime(step);
    });
  }
}

function lines(): string[] {
  return Array.from(document.querySelectorAll('.terminal-line:not(.typing)'))
    .map((el) => el.textContent ?? '')
    .filter((t) => t !== '_');
}

function typingText(): string | null {
  const el = document.querySelector('.terminal-line.typing');
  return el ? (el.textContent ?? '').replace(/_$/, '') : null;
}

const FULL_SEQUENCE_MS = 40000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TerminalLoadingScreen', () => {
  it('renders the terminal chrome and a blinking cursor', () => {
    renderTerminal();
    expect(screen.getByRole('dialog', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getByText('FRINGE DIVISION // SECURE TERMINAL')).toBeInTheDocument();
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
    const cursor = () => document.querySelector('.terminal-cursor')!;
    expect(cursor()).toHaveClass('visible');
    advance(530, 530);
    expect(cursor()).not.toHaveClass('visible');
    advance(530, 530);
    expect(cursor()).toHaveClass('visible');
  });

  it('types the first line character by character after its delay', () => {
    renderTerminal();
    expect(typingText()).toBeNull();
    // First step: delay 200ms, then 15ms per char
    advance(200);
    expect(typingText()).toBe('');
    advance(15 * 5, 15);
    expect(typingText()).toBe('> FRI');
    advance(2000);
    expect(lines()[0]).toBe('> FRINGE DIVISION TERMINAL v5.0');
  });

  it('completes the full sequence without campaign/image lines when counts are null', () => {
    renderTerminal();
    advance(FULL_SEQUENCE_MS, 20);
    const text = lines().join('\n');
    expect(text).toContain('> [OK] ACCESS GRANTED');
    expect(text).toContain('> Loading Fringe Matrix Interface...');
    expect(text).not.toContain('social media campaigns found');
    expect(text).not.toContain('image files located');
    expect(document.querySelectorAll('.terminal-line.empty').length).toBeGreaterThan(0);
  });

  it('includes campaign and image counts when provided', () => {
    renderTerminal({ campaignCount: 42, imageCount: 7 });
    advance(FULL_SEQUENCE_MS, 20);
    const text = lines().join('\n');
    expect(text).toContain('> 42 social media campaigns found');
    expect(text).toContain('> Campaign classification: FANDOM AVATARS');
    expect(text).toContain('> 7 image files located in active campaign');
    expect(text).toContain('> File format: FRINGE AVATAR GRAPHICS');
  });

  it('restarts the typing sequence when counts change', () => {
    const { rerender, props } = renderTerminal();
    advance(3000);
    expect(lines().length).toBeGreaterThan(0);
    rerender(<TerminalLoadingScreen {...props} campaignCount={5} />);
    expect(lines()).toEqual([]);
    advance(FULL_SEQUENCE_MS, 20);
    expect(lines().join('\n')).toContain('> 5 social media campaigns found');
  });

  it('does not complete when the sequence finishes but data is not ready', () => {
    const { props } = renderTerminal();
    advance(FULL_SEQUENCE_MS, 20);
    expect(props.onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText(/Press ENTER/)).toBeNull();
  });

  it('auto-completes after the fade delay once the sequence finished and data is ready', () => {
    const onComplete = vi.fn();
    const { rerender } = renderTerminal({ onComplete });
    advance(FULL_SEQUENCE_MS, 20);
    rerender(<TerminalLoadingScreen campaignCount={null} imageCount={null} isDataReady onComplete={onComplete} />);
    advance(LOADING_SCREEN_AUTO_FADE_DELAY_MS - 10);
    expect(onComplete).not.toHaveBeenCalled();
    advance(20);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows the skip hint 500ms after data is ready and allows skipping mid-sequence', () => {
    const { props } = renderTerminal({ isDataReady: true });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(props.onComplete).not.toHaveBeenCalled();
    advance(SKIP_ENABLE_DELAY_MS);
    expect(screen.getByText(/Press ENTER, SPACE, or click anywhere/)).toBeInTheDocument();
    // Sequence is still typing — not auto-completed yet
    expect(props.onComplete).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  });

  it.each([' ', 'Escape'])('skips via "%s" and prevents default', (key) => {
    const { props } = renderTerminal({ isDataReady: true });
    advance(SKIP_ENABLE_DELAY_MS);
    const ev = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  });

  it('skips on click only when skippable', () => {
    const { props } = renderTerminal({ isDataReady: true });
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onComplete).not.toHaveBeenCalled();
    advance(SKIP_ENABLE_DELAY_MS);
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  });

  it('ignores keys and clicks when data never becomes ready', () => {
    const { props } = renderTerminal();
    advance(5000);
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('clears all timers and listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { props, unmount } = renderTerminal({ isDataReady: true });
    advance(SKIP_ENABLE_DELAY_MS + 1000);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    fireEvent.keyDown(document, { key: 'Enter' });
    advance(FULL_SEQUENCE_MS, 1000);
    expect(props.onComplete).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
