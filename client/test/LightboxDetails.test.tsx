import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LightboxDetails from '../src/components/LightboxDetails';
import type { Campaign, ImageAuthor } from '../src/types/api';

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

  it('omits the IMDB row when imdb_link is an empty string', () => {
    render(<LightboxDetails campaign={{ ...SAMPLE_CAMPAIGN, imdb_link: '' }} />);
    expect(screen.queryByText('IMDB')).toBeNull();
  });

  it('does NOT render Download or Share rows (still out of scope)', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
    expect(screen.queryByText(/^download$/i)).toBeNull();
    expect(screen.queryByText(/^share$/i)).toBeNull();
  });

  it('omits the AUTHOR row when no author prop is provided', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
    expect(screen.queryByText(/^author$/i)).toBeNull();
  });

  it('omits the AUTHOR row when author is null', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={null} />);
    expect(screen.queryByText(/^author$/i)).toBeNull();
  });

  it('renders an empty-state message when no campaign is provided', () => {
    render(<LightboxDetails campaign={null} />);
    expect(screen.getByText('IMAGE DETAILS')).toBeTruthy();
    expect(screen.getByText(/no campaign selected/i)).toBeTruthy();
  });

  describe('AUTHOR row', () => {
    const resolvedHigh: ImageAuthor = {
      handle: '@SarahProost',
      displayName: 'Sarah Proost',
      twitterUrl: 'https://twitter.com/SarahProost',
      confidence: 'high',
      candidates: [],
    };
    const resolvedMedium: ImageAuthor = {
      handle: '@Zort70',
      displayName: 'Zort',
      twitterUrl: 'https://twitter.com/Zort70',
      confidence: 'medium',
      candidates: [],
    };
    const unresolved: ImageAuthor = {
      handle: null,
      displayName: null,
      twitterUrl: null,
      confidence: 'unresolved',
      candidates: ['@AliceA', '@BobB', '@Carol_C'],
    };

    it('renders an AUTHOR row with avatar initials and a link for resolved high-confidence authors', () => {
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={resolvedHigh} />);
      expect(screen.getByText('AUTHOR')).toBeTruthy();
      // Avatar initials derived from camelCase
      expect(screen.getByText('SP')).toBeTruthy();
      const link = screen.getByRole('link', { name: /SarahProost/ });
      expect(link.getAttribute('href')).toBe('https://twitter.com/SarahProost');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      // No 'uncertain' badge for high confidence.
      expect(screen.queryByText(/uncertain/i)).toBeNull();
    });

    it('renders an "uncertain" badge for medium-confidence authors', () => {
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={resolvedMedium} />);
      expect(screen.getByText('AUTHOR')).toBeTruthy();
      expect(screen.getByText('ZO')).toBeTruthy();
      expect(screen.getByText(/uncertain/i)).toBeTruthy();
      expect(screen.getByRole('link', { name: /Zort70/ })).toBeTruthy();
    });

    it('renders "Possibly: @A, @B, @C" with a "?" avatar for unresolved authors with candidates', () => {
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={unresolved} />);
      expect(screen.getByText('AUTHOR')).toBeTruthy();
      expect(screen.getByText('?')).toBeTruthy();
      expect(screen.getByText(/Possibly:\s*@AliceA,\s*@BobB,\s*@Carol_C/)).toBeTruthy();
      // No link in unresolved state.
      expect(screen.queryByRole('link', { name: /AliceA/ })).toBeNull();
    });

    it('omits the AUTHOR row entirely when handle is null and there are no candidates', () => {
      const empty: ImageAuthor = {
        handle: null,
        displayName: null,
        twitterUrl: null,
        confidence: 'unresolved',
        candidates: [],
      };
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={empty} />);
      expect(screen.queryByText(/^author$/i)).toBeNull();
    });

    it('does not render a link when twitterUrl is missing for a resolved author', () => {
      const noUrl: ImageAuthor = {
        handle: '@cheribot',
        displayName: null,
        twitterUrl: null,
        confidence: 'high',
        candidates: [],
      };
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={noUrl} />);
      expect(screen.getByText('AUTHOR')).toBeTruthy();
      expect(screen.getByText('CH')).toBeTruthy();
      expect(screen.getByText('@cheribot')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /cheribot/ })).toBeNull();
    });

    it('rejects unsafe twitterUrl values and renders the handle as plain text', () => {
      const unsafe: ImageAuthor = {
        handle: '@evil',
        displayName: null,
        // eslint-disable-next-line no-script-url
        twitterUrl: 'javascript:alert(1)' as string,
        confidence: 'high',
        candidates: [],
      };
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={unsafe} />);
      expect(screen.getByText('@evil')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /evil/ })).toBeNull();
    });
  });
});
