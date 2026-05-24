import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { fetchJSON } from '../utils/fetchJSON';
import { getInitialsFromName } from '../utils/author';
import { isSafeUrl } from '../utils/isSafeUrl';
import type { AuthorDetailResponse, ImageData } from '../types/api';
import GalleryGrid, { type GalleryGridHandle } from './GalleryGrid';

interface Props {
  /** Handle of the author whose detail page we're rendering (includes leading "@"). */
  handle: string;
  /** Navigate back to the authors index page. */
  onBack: () => void;
  /**
   * Open the lightbox in author-browse mode against this author's full image
   * list. The App-level handler sets the lightbox image source to the
   * provided list and opens it at `index`. The list spans whatever campaigns
   * the author has attributed images in; per-image `campaignId` is carried so
   * the IMAGE DETAILS panel can resolve the source campaign per-image (see
   * fringematrix5-pyd).
   *
   * The list is `ImageData[]` (lightbox-ready) so App can stay agnostic to
   * the AuthorDetail response shape. Each image carries a synthesized
   * `author` derived from `data.author`, so the lightbox AUTHOR row renders
   * without an extra lookup.
   *
   * The 4th arg `thumbEl` is the clicked thumbnail `<img>`. App forwards it
   * to `useLightboxAnimations.openLightbox` so the zoom-in/zoom-out flight
   * has a real source rect to animate from/to. Matches the campaign-mode
   * `GalleryGrid.onImageClick(index, thumbEl)` contract — see
   * fringematrix5-jq33 for the author-browse parity work.
   */
  onOpenImage: (images: ImageData[], index: number, handle: string, thumbEl: HTMLImageElement) => void;
  /**
   * Optional ref forwarded onto the inner `<GalleryGrid />`. App owns the ref
   * and passes it down so `App.getThumbElement` can route to this grid when
   * the lightbox is in author-browse mode (lightboxImageSource.kind === 'author').
   */
  gridRef?: RefObject<GalleryGridHandle | null>;
}

/**
 * Author detail page. Shows the author's avatar, name, handle, image count,
 * and a mini grid of all their attributed images. Clicking a thumbnail opens
 * the lightbox at that image (in its source campaign).
 *
 * Errors render an inline message rather than crashing the app — 404s from a
 * missing handle surface as "Failed to load author".
 */
export default function AuthorDetail({ handle, onBack, onOpenImage, gridRef }: Props) {
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

  // Map the author-detail response into the `ImageData` shape the lightbox
  // expects. Each image gets a synthesized `author` block derived from the
  // shared `data.author` (handle / displayName / twitterUrl) plus the
  // per-image `confidence` from the attribution record. `candidates` stays
  // empty — the AuthorDetail response only lists resolved attributions, so
  // the unresolved-candidates branch in the lightbox AUTHOR row is never
  // reached from this source. Memoized so the array reference is stable
  // across re-renders that don't change `data` (e.g. parent re-renders).
  const lightboxImages = useMemo<ImageData[]>(() => {
    if (!data) return [];
    return data.images.map((image) => ({
      fileName: image.fileName,
      src: image.src,
      blobPath: image.blobPath,
      campaignId: image.campaignId,
      author: {
        handle: data.author.handle,
        displayName: data.author.name,
        twitterUrl: data.author.twitterUrl,
        confidence: image.confidence,
        candidates: [],
      },
    }));
  }, [data]);

  /**
   * Per-thumbnail click handler delegated to the parent. GalleryGrid passes
   * `(index, thumbEl)`; we forward the author-image list and handle so App's
   * `openLightboxForAuthor` can both open the lightbox against the right
   * source AND hand the thumbnail element to the zoom animation. Stable
   * across renders while `lightboxImages` / `data.author.handle` don't
   * change, keeping `React.memo(GalleryGrid)` effective.
   */
  const handleImageClick = useCallback(
    (index: number, thumbEl: HTMLImageElement) => {
      if (!data) return;
      onOpenImage(lightboxImages, index, data.author.handle, thumbEl);
    },
    [data, lightboxImages, onOpenImage],
  );

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
              {getInitialsFromName(data.author.name) || '?'}
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
            <GalleryGrid
              ref={gridRef}
              images={lightboxImages}
              onImageClick={handleImageClick}
              ariaLabel={`Images by ${data.author.name}`}
              testId="author-images-grid"
            />
          )}
        </>
      )}
    </main>
  );
}
