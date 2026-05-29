import React from 'react';
import type { ImageData } from '../types/api';
import { buildResponsiveThumbnail } from '../utils/responsiveImage';

interface ImageCardProps {
  image: ImageData;
  /** Stable callback — called when the card's image is clicked */
  onClick: (e: React.MouseEvent<HTMLImageElement>) => void;
  /** Ref callback for the <img> element (used by GalleryGrid to populate thumbMapRef) */
  imgRef?: (el: HTMLImageElement | null) => void;
  /**
   * When true, the image loads eagerly with high fetch priority. GalleryGrid
   * sets this for the first couple of rows so the above-the-fold thumbnails
   * start downloading immediately; everything else stays native-lazy.
   */
  eager?: boolean;
  /**
   * The thumbnail's rendered width in CSS pixels (the current
   * `--thumbnail-min-size` grid track minimum). Used to build the `sizes`
   * attribute so the browser requests an appropriately-sized variant from the
   * responsive `srcset`. Omitted/zero falls back to the smallest candidate.
   */
  thumbnailCssPx?: number;
}

/**
 * Memoized image card rendered inside GalleryGrid.
 *
 * Wrapping with React.memo means that as long as the image data and onClick
 * callback reference are the same between renders, React skips re-diffing this
 * card entirely — eliminating per-card VDOM work during App-level re-renders.
 */
const ImageCard = React.memo(function ImageCard({ image, onClick, imgRef, eager, thumbnailCssPx }: ImageCardProps) {
  // Build responsive thumbnail attributes. In production on Vercel this swaps
  // the original full-resolution Blob URL for a width-negotiated `srcset` of
  // optimized AVIF/WebP variants served from `/_vercel/image`; everywhere else
  // it returns just the original `src` so behavior is unchanged. The lightbox
  // is unaffected — it loads the original full-resolution image directly.
  const responsive = buildResponsiveThumbnail(
    image.loadedSrc || image.src || '',
    thumbnailCssPx ?? 0,
  );
  return (
    <div className="card">
      {image.isLoading ? (
        <div className="image-placeholder">
          <div className="placeholder-content">
            <div className="placeholder-icon">📷</div>
            <div className="placeholder-text">Loading...</div>
          </div>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={responsive.src}
          srcSet={responsive.srcSet}
          sizes={responsive.sizes}
          alt={image.fileName}
          loading={eager ? 'eager' : 'lazy'}
          // Spread the lowercase DOM attribute directly: react-dom 18 doesn't
          // recognize the camelCase `fetchPriority` prop (a React 19 feature)
          // and would warn, while @types/react 19 only types the camelCase
          // form — so a typed spread sets the real `fetchpriority` attribute
          // without a TS error or a runtime warning.
          {...{ fetchpriority: eager ? 'high' : 'auto' }}
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            // Keyboard activation: Enter or Space should behave like a click.
            // Triggering the native click event keeps the onClick callback's
            // MouseEvent contract intact (so consumers can still rely on
            // mouse-event semantics) and avoids unsafe type casts.
            if (e.key === 'Enter') {
              e.currentTarget.click();
            } else if (e.key === ' ' || e.key === 'Spacebar') {
              // preventDefault on Space suppresses the default page-scroll.
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        />
      )}
    </div>
  );
});

export default ImageCard;
