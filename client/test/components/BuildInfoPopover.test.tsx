import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BuildInfoPopover from '../../src/components/BuildInfoPopover';
import { formatTimePacific } from '../../src/utils/formatTimePacific';
import type { BuildInfo } from '../../src/types/api';

function renderPopover(buildInfo: BuildInfo | null, style: React.CSSProperties = {}) {
  const onClose = vi.fn();
  const utils = render(<BuildInfoPopover style={style} buildInfo={buildInfo} onClose={onClose} />);
  return { ...utils, onClose };
}

function valueForLabel(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const row = labelEl.closest('.row') as HTMLElement;
  return row.children[1] as HTMLElement;
}

describe('BuildInfoPopover', () => {
  it('renders a non-modal dialog labelled "Build Info" with the given style', () => {
    renderPopover(null, { top: 12, left: 34 });
    const dialog = screen.getByRole('dialog', { name: 'Build Info' });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(dialog).toHaveStyle({ top: '12px', left: '34px' });
  });

  it('shows N/A for every row when buildInfo is null', () => {
    renderPopover(null);
    expect(valueForLabel('Repo')).toHaveTextContent('N/A');
    expect(valueForLabel('Commit')).toHaveTextContent('N/A');
    expect(valueForLabel('Time of build:')).toHaveTextContent('N/A');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows N/A for every row when all fields are null', () => {
    renderPopover({ repoUrl: null, commitHash: null, builtAt: null });
    expect(screen.getAllByText('N/A')).toHaveLength(3);
  });

  it('converts an scp-style git remote into an https repo link', () => {
    renderPopover({ repoUrl: 'git@github.com:owner/repo.git', commitHash: null, builtAt: null });
    const link = screen.getByRole('link') as HTMLAnchorElement;
    expect(link.href).toBe('https://github.com/owner/repo');
    expect(link).toHaveTextContent('https://github.com/owner/repo');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noreferrer noopener');
  });

  it('shows N/A for an unparseable repo URL', () => {
    renderPopover({ repoUrl: 'not-a-url', commitHash: 'abc', builtAt: null });
    expect(screen.queryByRole('link')).toBeNull();
    expect(valueForLabel('Repo')).toHaveTextContent('N/A');
  });

  it('renders the commit hash in monospace with a title attribute', () => {
    renderPopover({ repoUrl: null, commitHash: 'deadbeefcafe', builtAt: null });
    const commit = screen.getByText('deadbeefcafe');
    expect(commit).toHaveAttribute('title', 'deadbeefcafe');
    expect(commit).toHaveClass('value', 'monospace');
  });

  it('renders the build time formatted in Pacific time', () => {
    const builtAt = '2024-01-15 14:30:45 PST';
    renderPopover({ repoUrl: null, commitHash: null, builtAt });
    expect(valueForLabel('Time of build:')).toHaveTextContent(formatTimePacific(builtAt) as string);
    expect(valueForLabel('Time of build:')).toHaveTextContent('January 15th, 2024, 14:30:45 PST');
  });

  it('calls onClose when the close button is clicked', () => {
    const { onClose } = renderPopover(null);
    fireEvent.click(screen.getByRole('button', { name: 'Close build info' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
