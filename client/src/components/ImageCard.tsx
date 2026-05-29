import React from 'react';
import type { ImageData } from '../types/api';

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
}

/**
 * Memoized image card rendered inside GalleryGrid.
 *
 * Wrapping with React.memo means that as long as the image data and onClick
 * callback reference are the same between renders, React skips re-diffing this
 * card entirely — eliminating per-card VDOM work during App-level re-renders.
 */
const ImageCard = React.memo(function ImageCard({ image, onClick, imgRef, eager }: ImageCardProps) {
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
          src={image.loadedSrc || image.src || ''}
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
