import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CampaignNavigation from '../../src/components/CampaignNavigation';
import type { Campaign } from '../../src/types/api';

function makeCampaign(id: string, hashtag: string): Campaign {
  return { id, hashtag, episode: id, episode_id: id, date: '2012-01-01', icon_path: `${id}.png` };
}

const CAMPAIGNS = [makeCampaign('c1', 'FringeOne'), makeCampaign('c2', 'FringeTwo'), makeCampaign('c3', 'FringeThree')];

type Props = React.ComponentProps<typeof CampaignNavigation>;

function renderNav(overrides: Partial<Props> = {}) {
  const props: Props = {
    campaigns: CAMPAIGNS,
    activeCampaignId: 'c2',
    isOpen: true,
    isCampaignLoading: false,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const utils = render(<CampaignNavigation {...props} />);
  return { ...utils, props };
}

describe('CampaignNavigation', () => {
  it('renders a button per campaign with the hashtag', () => {
    renderNav();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '#FringeOne',
      '#FringeTwo',
      '#FringeThree',
    ]);
  });

  it('marks only the active campaign with the active class', () => {
    renderNav();
    expect(screen.getByText('#FringeTwo')).toHaveClass('sidebar-item', 'active');
    expect(screen.getByText('#FringeOne')).not.toHaveClass('active');
    expect(screen.getByText('#FringeThree')).not.toHaveClass('active');
  });

  it('marks nothing active when activeCampaignId is null', () => {
    renderNav({ activeCampaignId: null });
    expect(document.querySelectorAll('.sidebar-item.active')).toHaveLength(0);
  });

  it('adds the open class, exposes the sidebar and renders the overlay when open', () => {
    renderNav();
    const aside = document.getElementById('campaign-sidebar')!;
    expect(aside).toHaveClass('sidebar', 'open');
    expect(aside).toHaveAttribute('aria-hidden', 'false');
    expect(document.querySelector('.sidebar-overlay')).not.toBeNull();
    screen.getAllByRole('button').forEach((b) => expect(b).toHaveAttribute('tabindex', '0'));
  });

  it('hides the sidebar, removes buttons from tab order and omits overlay when closed', () => {
    renderNav({ isOpen: false });
    const aside = document.getElementById('campaign-sidebar')!;
    expect(aside).not.toHaveClass('open');
    expect(aside).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('.sidebar-overlay')).toBeNull();
    aside.querySelectorAll('button').forEach((b) => expect(b).toHaveAttribute('tabindex', '-1'));
  });

  it('disables all items while a campaign is loading', () => {
    const { props } = renderNav({ isCampaignLoading: true });
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
    fireEvent.click(screen.getByText('#FringeOne'));
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect with the id and then onClose', async () => {
    const order: string[] = [];
    const onSelect = vi.fn((id: string) => {
      order.push(`select:${id}`);
    });
    const onClose = vi.fn(() => order.push('close'));
    renderNav({ onSelect, onClose });
    fireEvent.click(screen.getByText('#FringeThree'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['select:c3', 'close']);
  });

  it('waits for an async onSelect before closing', async () => {
    let resolve!: () => void;
    const onSelect = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const onClose = vi.fn();
    renderNav({ onSelect, onClose });
    fireEvent.click(screen.getByText('#FringeOne'));
    expect(onSelect).toHaveBeenCalledWith('c1');
    await Promise.resolve();
    expect(onClose).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('closes when the overlay is clicked', () => {
    const { props } = renderNav();
    fireEvent.click(document.querySelector('.sidebar-overlay')!);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('renders an empty list without crashing', () => {
    renderNav({ campaigns: [] });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('All Campaigns')).toBeInTheDocument();
  });
});
