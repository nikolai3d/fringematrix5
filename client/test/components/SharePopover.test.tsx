import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SharePopover from '../../src/components/SharePopover';

const DEFAULT_PROPS = {
  style: {},
  threadsShareUrl: 'https://www.threads.net/intent/post?text=Check%20out%20Fringe%20Matrix&url=https%3A%2F%2Ffringematrix.art',
  blueskyShareUrl: 'https://bsky.app/intent/compose?text=Check%20out%20Fringe%20Matrix%20https%3A%2F%2Ffringematrix.art',
  redditShareUrl: 'https://www.reddit.com/submit?title=Check+out+Fringe+Matrix&url=https%3A%2F%2Ffringematrix.art',
  onClose: vi.fn(),
};

describe('SharePopover', () => {
  describe('Bluesky button', () => {
    it('renders a "Share on Bluesky" link', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      expect(screen.getByRole('link', { name: 'Share on Bluesky' })).toBeInTheDocument();
    });

    it('has the blueskyShareUrl as href', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Bluesky' }) as HTMLAnchorElement;
      expect(link.href).toBe(DEFAULT_PROPS.blueskyShareUrl);
    });

    it('has target="_blank"', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Bluesky' }) as HTMLAnchorElement;
      expect(link.target).toBe('_blank');
    });

    it('has rel="noreferrer noopener"', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Bluesky' }) as HTMLAnchorElement;
      expect(link.rel).toBe('noreferrer noopener');
    });

    it('href starts with bsky.app/intent/compose?text= and decoded text contains SITE_URL', () => {
      const siteUrl = 'https://fringematrix.art';
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Bluesky' }) as HTMLAnchorElement;
      expect(link.href).toMatch(/^https:\/\/bsky\.app\/intent\/compose\?text=/);
      const url = new URL(link.href);
      const text = url.searchParams.get('text') ?? '';
      expect(text).toContain(siteUrl);
    });

    it('applies the action-btn class', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Bluesky' });
      expect(link.className).toBe('action-btn');
    });
  });

  describe('Reddit button', () => {
    it('renders a "Share on Reddit" link', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      expect(screen.getByRole('link', { name: 'Share on Reddit' })).toBeInTheDocument();
    });

    it('has the redditShareUrl as href', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Reddit' }) as HTMLAnchorElement;
      expect(link.href).toBe(DEFAULT_PROPS.redditShareUrl);
    });

    it('has target="_blank"', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Reddit' }) as HTMLAnchorElement;
      expect(link.target).toBe('_blank');
    });

    it('has rel="noreferrer noopener"', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Reddit' }) as HTMLAnchorElement;
      expect(link.rel).toBe('noreferrer noopener');
    });

    it('href starts with reddit.com/submit? and decoded params include SITE_URL and SITE_SHARE_TEXT', () => {
      const siteUrl = 'https://fringematrix.art';
      const siteShareText = 'Check out Fringe Matrix';
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Reddit' }) as HTMLAnchorElement;
      expect(link.href).toMatch(/^https:\/\/www\.reddit\.com\/submit\?/);
      const url = new URL(link.href);
      expect(url.searchParams.get('url')).toBe(siteUrl);
      expect(url.searchParams.get('title')).toBe(siteShareText);
    });

    it('applies the action-btn class', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      const link = screen.getByRole('link', { name: 'Share on Reddit' });
      expect(link.className).toBe('action-btn');
    });
  });

  describe('Threads button', () => {
    it('still renders a "Share on Threads" link', () => {
      render(<SharePopover {...DEFAULT_PROPS} />);
      expect(screen.getByRole('link', { name: 'Share on Threads' })).toBeInTheDocument();
    });
  });
});
