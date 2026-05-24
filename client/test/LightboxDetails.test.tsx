import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.queryByText(/^artist$/i)).toBeNull();
  });

  it('omits the AUTHOR row when author is null', () => {
    render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={null} />);
    expect(screen.queryByText(/^artist$/i)).toBeNull();
  });

  it('renders an empty-state message when no campaign is provided', () => {
    render(<LightboxDetails campaign={null} />);
    expect(screen.getByText('IMAGE DETAILS')).toBeTruthy();
    expect(screen.getByText(/no campaign selected/i)).toBeTruthy();
  });

  describe('EPISODE NAME → campaign gallery link (fringematrix5-c320)', () => {
    it('renders the episode name as plain text when no onOpenCampaignGallery handler is provided', () => {
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
      // No button-role element with the episode name.
      expect(
        screen.queryByRole('button', { name: /Back To Where You've Never Been/ })
      ).toBeNull();
      // The episode name is still rendered (as plain text).
      expect(screen.getByText("Back To Where You've Never Been")).toBeTruthy();
    });

    it('renders the episode name as a button when onOpenCampaignGallery is provided', () => {
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      const btn = screen.getByRole('button', {
        name: /view campaign gallery for back to where you've never been/i,
      });
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
      // Must be of type="button" so it never accidentally submits a form.
      expect(btn.getAttribute('type')).toBe('button');
    });

    it('invokes onOpenCampaignGallery with the campaign id on click', () => {
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      // Scope to the EPISODE NAME button specifically — the HASHTAG row
      // also exposes a "view campaign gallery for #..." button now
      // (fringematrix5-8fwv), so an unanchored regex would match both.
      const btn = screen.getByRole('button', {
        name: /view campaign gallery for back to where you've never been/i,
      });
      fireEvent.click(btn);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith('crosstheline');
    });

    it('is focusable and uses a native <button> so the browser handles Enter/Space activation', () => {
      // We intentionally do NOT dispatch a synthetic keydown here: jsdom
      // does not translate Enter on a <button> into a click event, so a
      // fake keypress would only test our scaffolding rather than the
      // contract. The acceptance criterion ("Enter activates") is met by
      // being a real <button> with type="button" and an onClick handler —
      // real browsers perform the Enter/Space → click translation natively.
      // (Copilot reviewer flagged the previous test's misleading name.)
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      // Same scoping note as above — name the EPISODE NAME button
      // explicitly to disambiguate from the HASHTAG button.
      const btn = screen.getByRole('button', {
        name: /view campaign gallery for back to where you've never been/i,
      }) as HTMLButtonElement;
      // Focusable via .focus().
      btn.focus();
      expect(document.activeElement).toBe(btn);
      // Native <button>, not a div+role.
      expect(btn.tagName).toBe('BUTTON');
      // Not disabled.
      expect(btn.hasAttribute('disabled')).toBe(false);
    });

    it('keeps the IMDB row as a real external anchor (not affected by the new affordance)', () => {
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      const link = screen.getByRole('link', { name: /tt2125636/ });
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe('http://www.imdb.com/title/tt2125636/');
      expect(link.getAttribute('target')).toBe('_blank');
    });
  });

  describe('HASHTAG → campaign gallery link (fringematrix5-8fwv)', () => {
    it('renders the hashtag as plain text when no onOpenCampaignGallery handler is provided', () => {
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} />);
      // No button-role element for the hashtag value.
      expect(screen.queryByRole('button', { name: /#CrossTheLine/ })).toBeNull();
      // The hashtag value is still rendered (as plain text).
      expect(screen.getByText('#CrossTheLine')).toBeTruthy();
    });

    it('renders the hashtag as a button when onOpenCampaignGallery is provided', () => {
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      const btn = screen.getByRole('button', {
        name: /view campaign gallery for #crosstheline/i,
      });
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
      // Must be of type="button" so it never accidentally submits a form.
      expect(btn.getAttribute('type')).toBe('button');
      // The `#` sigil is INSIDE the button so the whole visible hashtag is
      // a single click target.
      expect(btn.textContent).toBe('#CrossTheLine');
    });

    it('invokes onOpenCampaignGallery with the campaign id when the hashtag is clicked', () => {
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      const btn = screen.getByRole('button', {
        name: /view campaign gallery for #crosstheline/i,
      });
      fireEvent.click(btn);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith('crosstheline');
    });

    it('reuses the same `.lightbox-details-campaign-link` class as the EPISODE NAME affordance', () => {
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      const episodeBtn = screen.getByRole('button', {
        name: /view campaign gallery for back to where you've never been/i,
      });
      const hashtagBtn = screen.getByRole('button', {
        name: /view campaign gallery for #crosstheline/i,
      });
      expect(episodeBtn.className).toContain('lightbox-details-campaign-link');
      expect(hashtagBtn.className).toContain('lightbox-details-campaign-link');
    });

    it('hashtag button is focusable (participates in lightbox focus trap)', () => {
      const onOpen = vi.fn();
      render(
        <LightboxDetails campaign={SAMPLE_CAMPAIGN} onOpenCampaignGallery={onOpen} />
      );
      const btn = screen.getByRole('button', {
        name: /view campaign gallery for #crosstheline/i,
      }) as HTMLButtonElement;
      btn.focus();
      expect(document.activeElement).toBe(btn);
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.hasAttribute('disabled')).toBe(false);
    });
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
      expect(screen.getByText('ARTIST')).toBeTruthy();
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
      expect(screen.getByText('ARTIST')).toBeTruthy();
      expect(screen.getByText('ZO')).toBeTruthy();
      expect(screen.getByText(/uncertain/i)).toBeTruthy();
      expect(screen.getByRole('link', { name: /Zort70/ })).toBeTruthy();
    });

    it('renders "Possibly: @A, @B, @C" with a "?" avatar for unresolved authors with candidates', () => {
      render(<LightboxDetails campaign={SAMPLE_CAMPAIGN} author={unresolved} />);
      expect(screen.getByText('ARTIST')).toBeTruthy();
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
      expect(screen.queryByText(/^artist$/i)).toBeNull();
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
      expect(screen.getByText('ARTIST')).toBeTruthy();
      expect(screen.getByText('CH')).toBeTruthy();
      expect(screen.getByText('@cheribot')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /cheribot/ })).toBeNull();
    });

    describe('onOpenAuthorGallery (fringematrix5-4a6o)', () => {
      it('renders the handle as a button that fires onOpenAuthorGallery when provided', () => {
        const onOpen = vi.fn();
        render(
          <LightboxDetails
            campaign={SAMPLE_CAMPAIGN}
            author={resolvedHigh}
            onOpenAuthorGallery={onOpen}
          />,
        );
        const handleBtn = screen.getByRole('button', { name: /SarahProost/ });
        expect(handleBtn.tagName).toBe('BUTTON');
        fireEvent.click(handleBtn);
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith('@SarahProost');
      });

      it('still exposes the external Twitter link as a separate icon when callback is provided', () => {
        const onOpen = vi.fn();
        render(
          <LightboxDetails
            campaign={SAMPLE_CAMPAIGN}
            author={resolvedHigh}
            onOpenAuthorGallery={onOpen}
          />,
        );
        const twitterLink = screen.getByRole('link', { name: /Twitter/i });
        expect(twitterLink.getAttribute('href')).toBe('https://twitter.com/SarahProost');
        expect(twitterLink.getAttribute('target')).toBe('_blank');
        expect(twitterLink.getAttribute('rel')).toBe('noopener noreferrer');
      });

      it('omits the Twitter icon when twitterUrl is missing, even with callback provided', () => {
        const onOpen = vi.fn();
        const noUrl: ImageAuthor = {
          handle: '@cheribot',
          displayName: null,
          twitterUrl: null,
          confidence: 'high',
          candidates: [],
        };
        render(
          <LightboxDetails
            campaign={SAMPLE_CAMPAIGN}
            author={noUrl}
            onOpenAuthorGallery={onOpen}
          />,
        );
        expect(screen.getByRole('button', { name: /cheribot/ })).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Twitter/i })).toBeNull();
      });

      it('omits the Twitter icon when twitterUrl is unsafe, even with callback provided', () => {
        const onOpen = vi.fn();
        const unsafe: ImageAuthor = {
          handle: '@evil',
          displayName: null,
          // eslint-disable-next-line no-script-url
          twitterUrl: 'javascript:alert(1)' as string,
          confidence: 'high',
          candidates: [],
        };
        render(
          <LightboxDetails
            campaign={SAMPLE_CAMPAIGN}
            author={unsafe}
            onOpenAuthorGallery={onOpen}
          />,
        );
        expect(screen.getByRole('button', { name: /evil/ })).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Twitter/i })).toBeNull();
      });

      it('does not render a handle button for the unresolved (candidates-only) case', () => {
        const onOpen = vi.fn();
        const unresolvedAuthor: ImageAuthor = {
          handle: null,
          displayName: null,
          twitterUrl: null,
          confidence: 'unresolved',
          candidates: ['@AliceA', '@BobB'],
        };
        render(
          <LightboxDetails
            campaign={SAMPLE_CAMPAIGN}
            author={unresolvedAuthor}
            onOpenAuthorGallery={onOpen}
          />,
        );
        expect(screen.queryByRole('button', { name: /AliceA|BobB/ })).toBeNull();
        // Callback never invoked just by rendering.
        expect(onOpen).not.toHaveBeenCalled();
      });

      it('handle button is focusable (participates in lightbox focus trap)', () => {
        const onOpen = vi.fn();
        render(
          <LightboxDetails
            campaign={SAMPLE_CAMPAIGN}
            author={resolvedHigh}
            onOpenAuthorGallery={onOpen}
          />,
        );
        const handleBtn = screen.getByRole('button', { name: /SarahProost/ });
        handleBtn.focus();
        expect(document.activeElement).toBe(handleBtn);
      });
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
