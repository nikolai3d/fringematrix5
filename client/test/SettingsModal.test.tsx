import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SettingsModal from '../src/components/SettingsModal';

function renderModal(overrides: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    isReduceMotion: false,
    isReduceEffects: false,
    onToggleReduceMotion: vi.fn(),
    onToggleReduceEffects: vi.fn(),
    ...overrides,
  };
  return { ...render(<SettingsModal {...props} />), props };
}

describe('SettingsModal', () => {
  describe('visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = renderModal({ isOpen: false });
      expect(container.firstChild).toBeNull();
    });

    it('renders the modal when isOpen is true', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Settings')).toBeDefined();
    });
  });

  describe('reduce-motion toggle', () => {
    it('aria-checked is "false" when isReduceMotion=false', () => {
      renderModal({ isReduceMotion: false });
      const toggle = screen.getByRole('switch', { name: /reduce motion/i });
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('aria-checked is "true" when isReduceMotion=true', () => {
      renderModal({ isReduceMotion: true });
      const toggle = screen.getByRole('switch', { name: /reduce motion/i });
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('calls onToggleReduceMotion when the toggle is clicked', () => {
      const { props } = renderModal();
      const toggle = screen.getByRole('switch', { name: /reduce motion/i });
      fireEvent.click(toggle);
      expect(props.onToggleReduceMotion).toHaveBeenCalledTimes(1);
    });

    it('does not call onToggleReduceEffects when reduce-motion toggle is clicked', () => {
      const { props } = renderModal();
      fireEvent.click(screen.getByRole('switch', { name: /reduce motion/i }));
      expect(props.onToggleReduceEffects).not.toHaveBeenCalled();
    });
  });

  describe('reduce-effects toggle', () => {
    it('aria-checked is "false" when isReduceEffects=false', () => {
      renderModal({ isReduceEffects: false });
      const toggle = screen.getByRole('switch', { name: /reduce effects/i });
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('aria-checked is "true" when isReduceEffects=true', () => {
      renderModal({ isReduceEffects: true });
      const toggle = screen.getByRole('switch', { name: /reduce effects/i });
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('calls onToggleReduceEffects when the toggle is clicked', () => {
      const { props } = renderModal();
      const toggle = screen.getByRole('switch', { name: /reduce effects/i });
      fireEvent.click(toggle);
      expect(props.onToggleReduceEffects).toHaveBeenCalledTimes(1);
    });

    it('does not call onToggleReduceMotion when reduce-effects toggle is clicked', () => {
      const { props } = renderModal();
      fireEvent.click(screen.getByRole('switch', { name: /reduce effects/i }));
      expect(props.onToggleReduceMotion).not.toHaveBeenCalled();
    });
  });

  describe('close button', () => {
    it('calls onClose when close button is clicked', () => {
      const { props } = renderModal();
      const closeBtn = screen.getByRole('button', { name: /close settings/i });
      fireEvent.click(closeBtn);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the overlay backdrop is clicked', () => {
      const { props } = renderModal();
      // The overlay is the outermost element (role="dialog")
      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when clicking inside the modal content', () => {
      const { props } = renderModal();
      // Clicking the modal body stops propagation, so onClose should not fire
      const heading = screen.getByText('Accessibility');
      fireEvent.click(heading);
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  describe('toggle independence', () => {
    it('each toggle only reflects its own prop', () => {
      renderModal({ isReduceMotion: true, isReduceEffects: false });
      expect(screen.getByRole('switch', { name: /reduce motion/i }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('switch', { name: /reduce effects/i }).getAttribute('aria-checked')).toBe('false');
    });

    it('both toggles can be active simultaneously', () => {
      renderModal({ isReduceMotion: true, isReduceEffects: true });
      expect(screen.getByRole('switch', { name: /reduce motion/i }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('switch', { name: /reduce effects/i }).getAttribute('aria-checked')).toBe('true');
    });
  });
});
