import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ThumbnailSizeSlider from '../../src/components/ThumbnailSizeSlider';

function renderSlider(
  overrides: Partial<React.ComponentProps<typeof ThumbnailSizeSlider>> = {},
) {
  const props = {
    value: 0,
    steps: 5,
    onChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<ThumbnailSizeSlider {...props} />), props };
}

describe('ThumbnailSizeSlider', () => {
  describe('range attributes', () => {
    it('renders with min=0, step=1 and max=steps-1', () => {
      renderSlider({ steps: 5 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.type).toBe('range');
      expect(input.getAttribute('min')).toBe('0');
      expect(input.getAttribute('step')).toBe('1');
      expect(input.getAttribute('max')).toBe('4');
    });

    it('clamps max to 0 when steps is 1', () => {
      renderSlider({ steps: 1 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.getAttribute('max')).toBe('0');
    });

    it('clamps max to 0 when steps is 0', () => {
      renderSlider({ steps: 0 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.getAttribute('max')).toBe('0');
    });

    it('clamps max to 0 when steps is negative', () => {
      renderSlider({ steps: -3 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.getAttribute('max')).toBe('0');
    });
  });

  describe('current value', () => {
    it("reflects the current value in the input's value attribute", () => {
      renderSlider({ value: 2, steps: 5 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.value).toBe('2');
    });

    it('updates value attribute when re-rendered with a new value', () => {
      const { rerender } = renderSlider({ value: 1, steps: 5 });
      let input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.value).toBe('1');

      rerender(
        <ThumbnailSizeSlider value={3} steps={5} onChange={vi.fn()} />,
      );
      input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.value).toBe('3');
    });

    it('does NOT set aria-valuenow manually (relies on native range semantics)', () => {
      renderSlider({ value: 2, steps: 5 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.hasAttribute('aria-valuenow')).toBe(false);
    });
  });

  describe('onChange', () => {
    it('fires onChange with the new index (as a number) when the slider moves', () => {
      const onChange = vi.fn();
      renderSlider({ value: 0, steps: 5, onChange });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '3' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('passes a parsed integer (not a string) to onChange', () => {
      const onChange = vi.fn();
      renderSlider({ value: 0, steps: 5, onChange });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '2' } });
      const arg = onChange.mock.calls[0][0];
      expect(typeof arg).toBe('number');
      expect(arg).toBe(2);
    });
  });

  describe('label association', () => {
    it("the 'THUMBNAIL SIZE' label is associated with the input via htmlFor/id", () => {
      const { container } = renderSlider();
      const label = container.querySelector(
        'label.thumbnail-size-slider-label',
      ) as HTMLLabelElement;
      const input = container.querySelector(
        'input[type="range"]',
      ) as HTMLInputElement;
      expect(label).not.toBeNull();
      expect(input).not.toBeNull();
      expect(label.htmlFor).toBe(input.id);
      expect(input.id).toBeTruthy();
    });

    it('getByLabelText("THUMBNAIL SIZE") resolves to the range input', () => {
      renderSlider();
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.tagName).toBe('INPUT');
      expect(input.type).toBe('range');
    });

    it('does NOT set an aria-label on the input (uses <label htmlFor> instead)', () => {
      renderSlider();
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.hasAttribute('aria-label')).toBe(false);
    });
  });

  describe('disabled state', () => {
    it('renders disabled when steps is 1', () => {
      renderSlider({ steps: 1 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('renders disabled when steps is 0', () => {
      renderSlider({ steps: 0 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('is enabled when steps is 2 or more', () => {
      renderSlider({ steps: 2 });
      const input = screen.getByLabelText('THUMBNAIL SIZE') as HTMLInputElement;
      expect(input.disabled).toBe(false);
    });
  });

  describe('tick marks', () => {
    it('renders one tick mark per step', () => {
      const { container } = renderSlider({ steps: 5 });
      const ticks = container.querySelectorAll('.thumbnail-size-slider-tick');
      expect(ticks.length).toBe(5);
    });

    it('renders zero tick marks when steps is 0 or negative', () => {
      const { container, rerender } = renderSlider({ steps: 0 });
      expect(
        container.querySelectorAll('.thumbnail-size-slider-tick').length,
      ).toBe(0);

      rerender(
        <ThumbnailSizeSlider value={0} steps={-2} onChange={vi.fn()} />,
      );
      expect(
        container.querySelectorAll('.thumbnail-size-slider-tick').length,
      ).toBe(0);
    });
  });

  describe('zoom buttons', () => {
    it('renders a "Zoom in" button and a "Zoom out" button', () => {
      renderSlider({ value: 2, steps: 5 });
      expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    });

    it('clicking "Zoom in" calls onChange with value + 1', () => {
      const onChange = vi.fn();
      renderSlider({ value: 2, steps: 5, onChange });
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('clicking "Zoom out" calls onChange with value - 1', () => {
      const onChange = vi.fn();
      renderSlider({ value: 2, steps: 5, onChange });
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('"Zoom out" is disabled at the minimum (value === 0)', () => {
      renderSlider({ value: 0, steps: 5 });
      const zoomOut = screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
      expect(zoomOut.disabled).toBe(true);
    });

    it('"Zoom in" is disabled at the maximum (value === steps - 1)', () => {
      renderSlider({ value: 4, steps: 5 });
      const zoomIn = screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement;
      expect(zoomIn.disabled).toBe(true);
    });

    it('"Zoom out" is enabled when value > 0', () => {
      renderSlider({ value: 1, steps: 5 });
      const zoomOut = screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
      expect(zoomOut.disabled).toBe(false);
    });

    it('"Zoom in" is enabled when value < max', () => {
      renderSlider({ value: 3, steps: 5 });
      const zoomIn = screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement;
      expect(zoomIn.disabled).toBe(false);
    });

    it('clicking "Zoom in" does not call onChange when already at max', () => {
      const onChange = vi.fn();
      renderSlider({ value: 4, steps: 5, onChange });
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('clicking "Zoom out" does not call onChange when already at min', () => {
      const onChange = vi.fn();
      renderSlider({ value: 0, steps: 5, onChange });
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('both buttons are disabled when steps <= 1', () => {
      renderSlider({ value: 0, steps: 1 });
      const zoomOut = screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
      const zoomIn = screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement;
      expect(zoomOut.disabled).toBe(true);
      expect(zoomIn.disabled).toBe(true);
    });
  });
});
