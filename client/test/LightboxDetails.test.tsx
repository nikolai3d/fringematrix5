import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LightboxDetails from '../src/components/LightboxDetails';
import type { Campaign } from '../src/types/api';

const SAMPLE_CAMPAIGN: Campaign = {
  id: 'crosstheline',
  hashtag: 'CrossTheLine',
  episode: "Back To Where You've Never Been",
  episode_id: '4.08',
  date: 'January 13th, 2012',
  icon_path: 'Season4/CrossTheLine',
  imdb_link: 'http://www.imdb.com/title/tt2125636/',
};

describe('LightboxDetails', () => {
  it('renders the IMAGE DETAILS heading', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
    expect(screen.getByText('IMAGE DETAILS')).toBeTruthy();
  });

  it('renders episode name, season/number, air date, hashtag', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
    expect(screen.getByText("Back To Where You've Never Been")).toBeTruthy();
    expect(screen.getByText('S4 · E08 (4.08)')).toBeTruthy();
    expect(screen.getByText('January 13th, 2012')).toBeTruthy();
    expect(screen.getByText('#CrossTheLine')).toBeTruthy();
  });

  it('renders IMDB link with extracted title id, opening in a new tab', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
    const link = screen.getByRole('link', { name: /tt2125636/ });
    expect(link.getAttribute('href')).toBe('http://www.imdb.com/title/tt2125636/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('falls back to raw episode_id when parseEpisodeId returns null', () => {
    const malformed: Campaign = { ...SAMPLE_CAMPAIGN, episode_id: 'bogus' };
    render(<LightboxDetails campaign={malformed} />);
    expect(screen.getByText('bogus')).toBeTruthy();
  });

  it('falls back to the full IMDB URL when no tt id is parseable', () => {
    const odd: Campaign = { ...SAMPLE_CAMPAIGN, imdb_link: 'https://example.com/foo' };
    render(<LightboxDetails campaign={odd} />);
    const link = screen.getByRole('link', { name: /example\.com/ });
    expect(link.getAttribute('href')).toBe('https://example.com/foo');
  });

  it('omits the IMDB row entirely when imdb_link is missing', () => {
    const { imdb_link, ...rest } = SAMPLE_CAMPAIGN;
    void imdb_link;
    render(<LightboxDetails campaign={rest as Campaign} />);
    expect(screen.queryByText('IMDB')).toBeNull();
  });

  it('does NOT render Download, Share, or Author rows (scope decisions)', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
    expect(screen.queryByText(/^download$/i)).toBeNull();
    expect(screen.queryByText(/^share$/i)).toBeNull();
    expect(screen.queryByText(/^author$/i)).toBeNull();
  });

  it('renders an empty-state message when no campaign is provided', () => {
    render(<LightboxDetails campaign={null} />);
    expect(screen.getByText('IMAGE DETAILS')).toBeTruthy();
    expect(screen.getByText(/no campaign selected/i)).toBeTruthy();
  });
});
