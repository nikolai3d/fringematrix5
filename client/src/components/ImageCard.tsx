import React from 'react';
import type { ImageData } from '../types/api';

interface ImageCardProps {
  image: ImageData;
  /** Stable callback — called when the card's image is clicked */
  onClick: (e: React.MouseEvent<HTMLImageElement>) => void;
  /** Ref callback for the <img> element (used by GalleryGrid to populate thumbMapRef) */
  imgRef?: (el: HTMLImageElement | null) => void;
}

/**
 * Memoized image card rendered inside GalleryGrid.
 *
 * Wrapping with React.memo means that as long as the image data and onClick
 * callback reference are the same between renders, React skips re-diffing this
 * card entirely — eliminating per-card VDOM work during App-level re-renders.
 */
const ImageCard = React.memo(function ImageCard({ image, onClick, imgRef }: ImageCardProps) {
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
          loading="lazy"
          onClick={onClick}
        />
      )}
      <div className="filename">{image.fileName}</div>
    </div>
  );
});

export default ImageCard;
