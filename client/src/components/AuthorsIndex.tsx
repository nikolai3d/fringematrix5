import { useEffect, useState } from 'react';
import { fetchJSON } from '../utils/fetchJSON';
import { getInitialsFromName } from '../utils/author';
import { isSafeUrl } from '../utils/isSafeUrl';
import type { AuthorsResponse, AuthorWithCount } from '../types/api';
import { UNKNOWN_ARTIST_HANDLE, UNKNOWN_ARTIST_NAME } from '../types/api';

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
 *
 * If the response includes a non-zero `unknownCount`, an additional pinned
 * "Unknown artist" card renders at the TOP of the grid (fringematrix5-obvh).
 * Clicking it routes to `#authors/__unknown__`, which the server's
 * `/api/authors/:handle` endpoint resolves to the list of every unattributed
 * image. The card uses a distinct visual treatment (`author-card--unknown`)
 * so it's visually separated from real artists.
 */
export default function AuthorsIndex({ onSelectAuthor, onBack }: Props) {
  const [authors, setAuthors] = useState<AuthorWithCount[] | null>(null);
  const [unknownCount, setUnknownCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJSON<AuthorsResponse>('/api/authors', { signal: controller.signal });
        if (cancelled) return;
        setAuthors(data.authors ?? []);
        // Defensive: older server responses may omit `unknownCount`. Treat
        // missing / non-finite / negative values as 0 (card stays hidden).
        const raw = data.unknownCount;
        setUnknownCount(typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load authors:', e);
        setError('Failed to load artists');
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const isLoading = authors === null && error === null;
  // The grid is "empty" only when there are no real artists AND no unknown
  // images to surface — otherwise the unknown card alone is enough content.
  const isEmpty = authors !== null && authors.length === 0 && unknownCount === 0;
  const hasContent = authors !== null && (authors.length > 0 || unknownCount > 0);

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
          Loading artists…
        </div>
      )}

      {error && (
        <div className="authors-error" role="alert">
          {error}
        </div>
      )}

      {isEmpty && (
        <div className="authors-status" role="status" aria-live="polite">
          No artists found.
        </div>
      )}

      {hasContent && (
        <section
          className="authors-grid"
          aria-label="Artists"
          data-testid="authors-grid"
        >
          {unknownCount > 0 && (
            <UnknownArtistCard
              imageCount={unknownCount}
              onClick={() => onSelectAuthor(UNKNOWN_ARTIST_HANDLE)}
            />
          )}
          {authors!.map((author) => (
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
  // Display-name flavored initials ("Sarah Proost" → "SP"). Falls back to
  // "?" for empty names so the avatar circle never renders blank.
  const initials = getInitialsFromName(author.name) || '?';
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

interface UnknownArtistCardProps {
  imageCount: number;
  onClick: () => void;
}

/**
 * Pinned "Unknown artist" card. Visually distinct from real-artist cards
 * (placeholder avatar with '?', `author-card--unknown` modifier) so users can
 * recognize it as a virtual aggregate. Click navigates to the
 * `#authors/__unknown__` detail view, which lists every image without a
 * resolved attribution.
 */
function UnknownArtistCard({ imageCount, onClick }: UnknownArtistCardProps) {
  return (
    <article
      className="author-card author-card--unknown"
      data-testid="unknown-artist-card"
    >
      <button
        type="button"
        className="author-card-button"
        onClick={onClick}
        aria-label={`Open ${UNKNOWN_ARTIST_NAME} (${imageCount} images)`}
      >
        <div
          className="author-avatar author-avatar--unknown"
          aria-hidden={true}
        >
          ?
        </div>
        <div className="author-name">{UNKNOWN_ARTIST_NAME}</div>
      </button>
      <div className="author-meta">
        <span className="author-handle author-handle--unknown">Unattributed</span>
        <span className="author-count" aria-label={`${imageCount} images`}>
          {imageCount} {imageCount === 1 ? 'image' : 'images'}
        </span>
      </div>
    </article>
  );
}
