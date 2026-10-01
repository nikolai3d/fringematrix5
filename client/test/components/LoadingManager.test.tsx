import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * LoadingManager chooses between the error overlay, the loading screen and
 * nothing. LoadingScreen chooses the concrete screen from LOADING_SCREEN_TYPE,
 * which is resolved at import time — so the config module is mocked per test
 * and the component graph re-imported.
 */

vi.mock('../../src/components/LegacyLoadingScreen', () => ({
  default: (p: { isDataReady: boolean }) => <div data-testid="legacy" data-ready={String(p.isDataReady)} />,
}));
vi.mock('../../src/components/TerminalLoadingScreen', () => ({
  default: (p: { campaignCount: number | null }) => (
    <div data-testid="terminal" data-count={String(p.campaignCount)} />
  ),
}));
vi.mock('../../src/components/GlyphsLoadingScreen', () => ({
  default: () => <div data-testid="glyphs" />,
}));

async function loadWithType(type: string) {
  vi.resetModules();
  vi.doMock('../../src/config/loadingScreen', () => ({
    LOADING_SCREEN_TYPE: type,
    LOADING_SCREEN_AUTO_FADE_DELAY_MS: 300,
  }));
  const [{ default: LoadingManager }, { default: LoadingScreen }] = await Promise.all([
    import('../../src/components/LoadingManager'),
    import('../../src/components/LoadingScreen'),
  ]);
  return { LoadingManager, LoadingScreen };
}

const baseProps = {
  campaignCount: 4,
  imageCount: 9,
  isDataReady: true,
  onComplete: () => {},
};

afterEach(() => {
  vi.doUnmock('../../src/config/loadingScreen');
  vi.resetModules();
});

describe('LoadingManager', () => {
  it('renders the CRT error overlay when loading failed (even if show=false)', async () => {
    const { LoadingManager } = await loadWithType('glyphs');
    render(<LoadingManager show={false} loadingError {...baseProps} />);
    const alert = screen.getByRole('alertdialog', { name: 'Loading failed' });
    expect(alert).toHaveAttribute('aria-modal', 'true');
    expect(alert).toHaveTextContent(/check your Internet connection/);
    expect(screen.queryByTestId('glyphs')).toBeNull();
  });

  it('prefers the error overlay over the loading screen when both apply', async () => {
    const { LoadingManager } = await loadWithType('glyphs');
    render(<LoadingManager show loadingError {...baseProps} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByTestId('glyphs')).toBeNull();
  });

  it('renders nothing when not shown and no error', async () => {
    const { LoadingManager } = await loadWithType('glyphs');
    const { container } = render(<LoadingManager show={false} loadingError={false} {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the configured loading screen and forwards props', async () => {
    const { LoadingManager } = await loadWithType('terminal');
    render(<LoadingManager show loadingError={false} {...baseProps} />);
    expect(screen.getByTestId('terminal')).toHaveAttribute('data-count', '4');
  });
});

describe('LoadingScreen', () => {
  it.each(['legacy', 'terminal', 'glyphs'])('renders the %s screen when configured', async (type) => {
    const { LoadingScreen } = await loadWithType(type);
    render(<LoadingScreen {...baseProps} />);
    expect(screen.getByTestId(type)).toBeInTheDocument();
  });

  it('falls back to the terminal screen for an unknown type', async () => {
    const { LoadingScreen } = await loadWithType('unknown');
    render(<LoadingScreen {...baseProps} />);
    expect(screen.getByTestId('terminal')).toBeInTheDocument();
  });

  it('forwards isDataReady to the legacy screen', async () => {
    const { LoadingScreen } = await loadWithType('legacy');
    render(<LoadingScreen {...baseProps} isDataReady={false} />);
    expect(screen.getByTestId('legacy')).toHaveAttribute('data-ready', 'false');
  });
});
