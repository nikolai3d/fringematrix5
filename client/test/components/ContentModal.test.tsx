import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import ContentModal from '../../src/components/ContentModal';
import type { ContentPage } from '../../src/types/api';

type Props = React.ComponentProps<typeof ContentModal>;

function renderModal(overrides: Partial<Props> = {}) {
  const props: Props = {
    activeModal: 'history',
    content: '<p>Hello <strong>world</strong></p>',
    isLoading: false,
    onClose: vi.fn(),
    ...overrides,
  };
  const utils = render(<ContentModal {...props} />);
  return { ...utils, props };
}

describe('ContentModal', () => {
  it('renders nothing when there is no active modal', () => {
    const { container } = renderModal({ activeModal: null });
    expect(container.firstChild).toBeNull();
  });

  it.each<[ContentPage, string]>([
    ['history', 'History'],
    ['credits', 'Credits'],
    ['legal', 'Legal'],
  ])('capitalises the title for "%s"', (page, title) => {
    renderModal({ activeModal: page });
    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(title)).toHaveAttribute('id', 'modal-title');
  });

  it('shows a loading indicator instead of content while loading', () => {
    renderModal({ isLoading: true });
    expect(screen.getByText('Loading...')).toHaveClass('content-modal-loading');
    expect(screen.queryByText('world')).toBeNull();
  });

  it('renders the HTML content', () => {
    renderModal();
    const strong = screen.getByText('world');
    expect(strong.tagName).toBe('STRONG');
    expect(strong.closest('p')).toHaveTextContent('Hello world');
  });

  it('closes when the overlay is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal body', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('world'));
    fireEvent.click(document.querySelector('.content-modal-header')!);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('closes via the close button', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const { props } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not react to Escape when closed', () => {
    const { props } = renderModal({ activeModal: null });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  describe('focus management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('moves focus to the close button after opening', () => {
      renderModal();
      const close = screen.getByRole('button', { name: 'Close' });
      expect(document.activeElement).not.toBe(close);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(document.activeElement).toBe(close);
    });

    it('does not steal focus if unmounted before the focus timer fires', () => {
      const { unmount } = renderModal();
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('traps Tab within the modal (last -> first, first -> last)', () => {
      renderModal({ content: '<a href="#one">one</a><a href="#two">two</a>' });
      const close = screen.getByRole('button', { name: 'Close' });
      const last = screen.getByText('two');
      last.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(close);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
  });
});
