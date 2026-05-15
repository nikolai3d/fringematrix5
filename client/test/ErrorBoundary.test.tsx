import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '../src/components/ErrorBoundary';

// Component that throws unconditionally on render
function AlwaysThrows(): React.ReactElement {
  throw new Error('Test error from child');
}

// Component that renders normally
function NormalChild(): React.ReactElement {
  return <div data-testid="normal-child">Hello from normal child</div>;
}

// Suppress console.error output from React's error boundary logging during tests
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('ErrorBoundary - fallback on child error', () => {
  it('renders the default fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    );

    // Default fallback has role="alert"
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('shows "Something went wrong." heading in default fallback', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong.')).toBeDefined();
  });

  it('shows a Reload button in default fallback', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /reload/i })).toBeDefined();
  });

  it('does NOT render the throwing child after it throws', () => {
    const { container } = render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    );

    // The AlwaysThrows component would render nothing visible,
    // but if the boundary wasn't working the whole render would crash.
    // Verify the fallback alert is present instead.
    expect(screen.getByRole('alert')).toBeDefined();
    // And that the container does not show child content at all
    expect(container.textContent).toContain('Something went wrong.');
  });

  it('renders a custom fallback prop instead of the default UI', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
        <AlwaysThrows />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeDefined();
    expect(screen.getByText('Custom error UI')).toBeDefined();
    // Default fallback should NOT appear
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('custom fallback replaces the throwing child entirely', () => {
    const { container } = render(
      <ErrorBoundary fallback={<span data-testid="oops">Oops</span>}>
        <AlwaysThrows />
      </ErrorBoundary>
    );

    expect(container.textContent).toBe('Oops');
  });
});

describe('ErrorBoundary - normal children render without interference', () => {
  it('renders children normally when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <NormalChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('normal-child')).toBeDefined();
    expect(screen.getByText('Hello from normal child')).toBeDefined();
  });

  it('does not show the fallback UI when children render successfully', () => {
    render(
      <ErrorBoundary>
        <NormalChild />
      </ErrorBoundary>
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Something went wrong.')).toBeNull();
  });

  it('passes through multiple healthy children', () => {
    render(
      <ErrorBoundary>
        <span data-testid="child-a">A</span>
        <span data-testid="child-b">B</span>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child-a')).toBeDefined();
    expect(screen.getByTestId('child-b')).toBeDefined();
  });
});
