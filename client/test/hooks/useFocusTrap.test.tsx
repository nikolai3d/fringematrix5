import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React, { useRef } from 'react';
import { useFocusTrap } from '../../src/hooks/useFocusTrap';

function Harness({
  active,
  onClose,
  children,
}: {
  active: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(active, ref, onClose);
  return (
    <>
      <button>outside</button>
      <div ref={ref} data-testid="trap">
        {children ?? (
          <>
            <button>first</button>
            <input aria-label="middle" />
            <button disabled>disabled</button>
            <button>last</button>
          </>
        )}
      </div>
    </>
  );
}

function tab(shiftKey = false) {
  const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  return ev;
}

describe('useFocusTrap', () => {
  it('Tab on the last focusable element wraps to the first', () => {
    render(<Harness active onClose={vi.fn()} />);
    screen.getByText('last').focus();
    const ev = tab();
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('Shift+Tab on the first focusable element wraps to the last (skipping disabled)', () => {
    render(<Harness active onClose={vi.fn()} />);
    screen.getByText('first').focus();
    const ev = tab(true);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('does not intercept Tab from a middle element', () => {
    render(<Harness active onClose={vi.fn()} />);
    const middle = screen.getByLabelText('middle');
    middle.focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(tab(true).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(middle);
  });

  it('does not intercept Shift+Tab from the last element', () => {
    render(<Harness active onClose={vi.fn()} />);
    screen.getByText('last').focus();
    expect(tab(true).defaultPrevented).toBe(false);
  });

  it('handles a container with no focusable elements without throwing', () => {
    render(
      <Harness active onClose={vi.fn()}>
        <span>nothing</span>
      </Harness>,
    );
    const outside = screen.getByText('outside');
    outside.focus();
    expect(() => tab()).not.toThrow();
    expect(() => tab(true)).not.toThrow();
    expect(document.activeElement).toBe(outside);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Harness active onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onClose = vi.fn();
    render(<Harness active onClose={onClose} />);
    screen.getByText('last').focus();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does nothing while inactive', () => {
    const onClose = vi.fn();
    render(<Harness active={false} onClose={onClose} />);
    screen.getByText('last').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tab().defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('removes the listener when deactivated', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness active onClose={onClose} />);
    rerender(<Harness active={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const onClose = vi.fn();
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<Harness active onClose={onClose} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it('uses the latest onClose after it changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness active onClose={first} />);
    rerender(<Harness active onClose={second} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
