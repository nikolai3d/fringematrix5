import { useEffect, useState } from 'react';
import { fetchJSON } from '../utils/fetchJSON';
import { getInitials } from '../utils/author';
import { isSafeUrl } from '../utils/isSafeUrl';
import type { AuthorsResponse, AuthorWithCount } from '../types/api';

interface Props {
  /** Navigate to a single-author detail page. */
  onSelectAuthor: (handle: string) => void;
  /** Navigate back to the main gallery. */
  onBack: () => void;
}

/**
 * Authors index page. Lists all known artists as cards (avatar + name + handle
 * + image count). Sorted by imageCount desc — the order is preserved from the
 * /api/authors response.
 */
export default function AuthorsIndex({ onSelectAuthor, onBack }: Props) {
  const [authors, setAuthors] = useState<AuthorWithCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJSON<AuthorsResponse>('/api/authors', { signal: controller.signal });
        if (cancelled) return;
        setAuthors(data.authors ?? []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load authors:', e);
        setError('Failed to load authors');
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const isLoading = authors === null && error === null;
  const isEmpty = authors !== null && authors.length === 0;

  return (
    <main className="content authors-page">
      <div className="authors-header">
        <button className="toolbar-button authors-back" onClick={onBack} aria-label="Back to gallery">
          ← Back
        </button>
        <h1>Artists</h1>
      </div>

      {isLoading && (
        <div className="authors-status" role="status" aria-live="polite">
          Loading authors…
        </div>
      )}

      {error && (
        <div className="authors-error" role="alert">
          {error}
        </div>
      )}

      {isEmpty && (
        <div className="authors-status" role="status" aria-live="polite">
          No authors found.
        </div>
      )}

      {authors && authors.length > 0 && (
        <section
          className="authors-grid"
          aria-label="Authors"
          data-testid="authors-grid"
        >
          {authors.map((author) => (
            <AuthorCard
              key={author.handle}
              author={author}
              onClick={() => onSelectAuthor(author.handle)}
            />
          ))}
        </section>
      )}
    </main>
  );
}

interface AuthorCardProps {
  author: AuthorWithCount;
  onClick: () => void;
}

function AuthorCard({ author, onClick }: AuthorCardProps) {
  // The 5s8 helper expects a handle, but its rules (extract uppercase letters,
  // else first-2-chars) also produce reasonable initials for display names
  // like "Sarah Proost" → "SP". Falls back to "?" for empty strings.
  const initials = getInitials(author.name) || getInitials(author.handle) || '?';
  const twitterSafe = isSafeUrl(author.twitterUrl);

  return (
    <article className="author-card" data-testid="author-card">
      <button
        type="button"
        className="author-card-button"
        onClick={onClick}
        aria-label={`Open ${author.name} (${author.imageCount} images)`}
      >
        <div className="author-avatar" aria-hidden={true}>{initials}</div>
        <div className="author-name">{author.name}</div>
      </button>
      <div className="author-meta">
        {twitterSafe && author.twitterUrl ? (
          <a
            className="author-handle"
            href={author.twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {author.handle}
          </a>
        ) : (
          <span className="author-handle">{author.handle}</span>
        )}
        <span className="author-count" aria-label={`${author.imageCount} images`}>
          {author.imageCount} {author.imageCount === 1 ? 'image' : 'images'}
        </span>
      </div>
    </article>
  );
}
