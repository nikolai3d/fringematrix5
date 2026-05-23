import { useEffect, useState } from 'react';
import { fetchJSON } from '../utils/fetchJSON';
import { getInitials } from '../utils/author';
import { isSafeUrl } from '../utils/isSafeUrl';
import type { AuthorDetailResponse } from '../types/api';

interface Props {
  /** Handle of the author whose detail page we're rendering (includes leading "@"). */
  handle: string;
  /** Navigate back to the authors index page. */
  onBack: () => void;
  /**
   * Navigate to a specific campaign in the main gallery. Used by image
   * thumbnails on the detail page to jump back to the campaign view.
   *
   * Lightbox integration with the source-of-truth state is intentionally
   * out of scope here — tracked as a follow-up bead.
   */
  onSelectCampaign: (campaignId: string) => void;
}

/**
 * Author detail page. Shows the author's avatar, name, handle, image count,
 * and a mini grid of all their attributed images. Clicking a thumbnail
 * navigates to that image's campaign view (no lightbox integration yet).
 *
 * Errors render an inline message rather than crashing the app — 404s from a
 * missing handle surface as "Failed to load author".
 */
export default function AuthorDetail({ handle, onBack, onSelectCampaign }: Props) {
  const [data, setData] = useState<AuthorDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    // Reset state when the handle changes so we don't briefly show stale
    // data (or a stale error alert) from the previous request before the
    // new one resolves.
    setData(null);
    setError(null);
    (async () => {
      try {
        // Server :handle param accepts the raw "@..." string; we URL-encode so
        // the leading "@" is transmitted safely as %40.
        const encoded = encodeURIComponent(handle);
        const res = await fetchJSON<AuthorDetailResponse>(`/api/authors/${encoded}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load author detail:', e);
        setData(null);
        setError('Failed to load author');
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [handle]);

  const isLoading = data === null && error === null;

  return (
    <main className="content authors-page author-detail">
      <div className="authors-header">
        <button
          className="toolbar-button authors-back"
          onClick={onBack}
          aria-label="Back to authors"
        >
          ← All authors
        </button>
      </div>

      {isLoading && (
        <div className="authors-status" role="status" aria-live="polite">
          Loading author…
        </div>
      )}

      {error && (
        <div className="authors-error" role="alert">
          {error}
        </div>
      )}

      {data && (
        <>
          <header className="author-detail-header">
            <div className="author-avatar author-avatar-large" aria-hidden={true}>
              {getInitials(data.author.name) || getInitials(data.author.handle) || '?'}
            </div>
            <div className="author-detail-info">
              <h1>{data.author.name}</h1>
              {isSafeUrl(data.author.twitterUrl) && data.author.twitterUrl ? (
                <a
                  className="author-handle"
                  href={data.author.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {data.author.handle}
                </a>
              ) : (
                <span className="author-handle">{data.author.handle}</span>
              )}
              <div className="author-count">
                {data.images.length} {data.images.length === 1 ? 'image' : 'images'}
              </div>
            </div>
          </header>

          {data.images.length === 0 ? (
            <div className="authors-status" role="status" aria-live="polite">
              No images attributed to this author yet.
            </div>
          ) : (
            <section
              className="gallery-grid"
              aria-label={`Images by ${data.author.name}`}
              data-testid="author-images-grid"
            >
              {data.images.map((image) => (
                <div className="card" key={image.blobPath}>
                  <button
                    type="button"
                    className="author-image-button"
                    onClick={() => onSelectCampaign(image.campaignId)}
                    aria-label={`Open campaign ${image.campaignId}`}
                  >
                    <img
                      src={image.src}
                      alt={image.fileName}
                      loading="lazy"
                    />
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
