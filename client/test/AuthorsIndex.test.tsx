import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';
import AuthorsIndex from '../src/components/AuthorsIndex';
import type { AuthorWithCount } from '../src/types/api';

const SAMPLE_AUTHORS: AuthorWithCount[] = [
  {
    handle: '@Zort70',
    name: 'Sarah Proost',
    twitterUrl: 'https://twitter.com/Zort70',
    alternateHandles: [],
    roles: ['artist'],
    imageCount: 244,
  },
  {
    handle: '@someone',
    name: 'Someone Else',
    twitterUrl: null,
    alternateHandles: [],
    roles: [],
    imageCount: 1,
  },
];

function mockFetch(response: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('AuthorsIndex', () => {
  it('renders a card for each author returned by /api/authors', async () => {
    globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS }) as unknown as typeof fetch;
    render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('author-card')).toHaveLength(2);
    });

    expect(screen.getByText('Sarah Proost')).toBeTruthy();
    expect(screen.getByText('Someone Else')).toBeTruthy();
    expect(screen.getByText('244 images')).toBeTruthy();
    expect(screen.getByText('1 image')).toBeTruthy();
  });

  it('linkifies the @handle to the twitterUrl when present', async () => {
    globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS }) as unknown as typeof fetch;
    render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

    const link = await screen.findByRole('link', { name: '@Zort70' });
    expect(link.getAttribute('href')).toBe('https://twitter.com/Zort70');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders @handle as plain text when twitterUrl is null', async () => {
    globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS }) as unknown as typeof fetch;
    render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

    await screen.findByText('Someone Else');
    expect(screen.queryByRole('link', { name: '@someone' })).toBeNull();
    expect(screen.getByText('@someone')).toBeTruthy();
  });

  it('calls onSelectAuthor with the handle when a card is clicked', async () => {
    globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS }) as unknown as typeof fetch;
    const onSelectAuthor = vi.fn();
    render(<AuthorsIndex onSelectAuthor={onSelectAuthor} onBack={() => {}} />);

    const sarahBtn = await screen.findByRole('button', { name: /Open Sarah Proost/ });
    fireEvent.click(sarahBtn);

    expect(onSelectAuthor).toHaveBeenCalledWith('@Zort70');
  });

  it('shows an inline error when the request fails', async () => {
    globalThis.fetch = mockFetch({ error: 'boom' }, 500) as unknown as typeof fetch;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load artists/i);
    });
    errSpy.mockRestore();
  });

  it('shows a friendly empty state when the API returns no authors', async () => {
    globalThis.fetch = mockFetch({ authors: [] }) as unknown as typeof fetch;
    render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/no artists found/i)).toBeTruthy();
    });
    expect(screen.queryByTestId('authors-grid')).toBeNull();
  });

  // fringematrix5-z86p
  describe('Attribution disclaimer', () => {
    it('renders the attribution disclaimer above the grid', async () => {
      globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      const disclaimer = await screen.findByTestId('authors-disclaimer');
      expect(disclaimer).toBeTruthy();
      // Body copy mentions incomplete / missing attribution.
      expect(disclaimer.textContent || '').toMatch(/attribution/i);
      expect(disclaimer.textContent || '').toMatch(/incomplete|lost|undercount/i);
    });

    it('links the Unknown artist mention to #authors/__unknown__', async () => {
      globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      const disclaimer = await screen.findByTestId('authors-disclaimer');
      const link = disclaimer.querySelector('a');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('#authors/__unknown__');
      expect(link!.textContent).toBe('Unknown artist');
    });

    it('renders the disclaimer even on the empty state', async () => {
      globalThis.fetch = mockFetch({ authors: [] }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText(/no artists found/i)).toBeTruthy();
      });
      expect(screen.getByTestId('authors-disclaimer')).toBeTruthy();
    });
  });

  // fringematrix5-obvh
  describe('Unknown artist pinned card', () => {
    it('renders the pinned "Unknown artist" card when unknownCount > 0', async () => {
      globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS, unknownCount: 42 }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      const card = await screen.findByTestId('unknown-artist-card');
      expect(card).toBeTruthy();
      // Scope to the card — the disclaimer above the grid also mentions
      // "Unknown artist" (as a link), so an unscoped getByText would match
      // multiple nodes.
      expect(within(card).getByText('Unknown artist')).toBeTruthy();
      expect(within(card).getByText('42 images')).toBeTruthy();
    });

    it('pins the Unknown artist card before all real-artist cards', async () => {
      globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS, unknownCount: 5 }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      await screen.findByTestId('unknown-artist-card');
      const grid = screen.getByTestId('authors-grid');
      // First child of the grid should be the unknown card; real-artist cards follow.
      const firstChild = grid.children[0] as HTMLElement;
      expect(firstChild.getAttribute('data-testid')).toBe('unknown-artist-card');
    });

    it('hides the Unknown artist card when unknownCount is 0', async () => {
      globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS, unknownCount: 0 }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      await screen.findAllByTestId('author-card');
      expect(screen.queryByTestId('unknown-artist-card')).toBeNull();
    });

    it('hides the Unknown artist card when unknownCount is missing (older server response)', async () => {
      globalThis.fetch = mockFetch({ authors: SAMPLE_AUTHORS }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      await screen.findAllByTestId('author-card');
      expect(screen.queryByTestId('unknown-artist-card')).toBeNull();
    });

    it('uses singular "image" copy when unknownCount is exactly 1', async () => {
      globalThis.fetch = mockFetch({ authors: [], unknownCount: 1 }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      await screen.findByTestId('unknown-artist-card');
      expect(screen.getByText('1 image')).toBeTruthy();
    });

    it('calls onSelectAuthor with the sentinel handle when the card is clicked', async () => {
      globalThis.fetch = mockFetch({ authors: [], unknownCount: 7 }) as unknown as typeof fetch;
      const onSelectAuthor = vi.fn();
      render(<AuthorsIndex onSelectAuthor={onSelectAuthor} onBack={() => {}} />);

      const btn = await screen.findByRole('button', { name: /Open Unknown artist/ });
      fireEvent.click(btn);

      expect(onSelectAuthor).toHaveBeenCalledWith('__unknown__');
    });

    it('shows the Unknown artist card even when there are no real artists', async () => {
      globalThis.fetch = mockFetch({ authors: [], unknownCount: 3 }) as unknown as typeof fetch;
      render(<AuthorsIndex onSelectAuthor={() => {}} onBack={() => {}} />);

      await screen.findByTestId('unknown-artist-card');
      // The friendly "No artists found" empty-state copy should NOT render
      // when we have unknown content to surface.
      expect(screen.queryByText(/no artists found/i)).toBeNull();
    });
  });
});
