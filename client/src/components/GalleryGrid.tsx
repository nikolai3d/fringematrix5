import React from 'react';
import type { ImageData } from '../types/api';

interface GalleryGridProps {
  images: ImageData[];
  /** Whether an active campaign is selected (used to show the empty state) */
  hasCampaign: boolean;
  /** Stable callback — receives the image index and the thumbnail element */
  onImageClick: (index: number, thumbEl: HTMLImageElement) => void;
}

/**
 * Memoized gallery grid.
 *
 * App re-renders at 2.5 Hz while loadingDots ticks during image preload.
 * Wrapping this section in React.memo prevents the entire N-card VDOM diff
 * from running on every tick — it only re-renders when images, hasCampaign,
 * or onImageClick actually change.
 */
const GalleryGrid = React.memo(function GalleryGrid({
  images,
  hasCampaign,
  onImageClick,
}: GalleryGridProps) {
  const isEmpty = hasCampaign && images.length === 0;

  return (
    <section
      id="gallery"
      className={`gallery-grid${isEmpty ? ' empty' : ''}`}
      aria-live="polite"
    >
      {isEmpty ? (
        <div className="empty-state" role="status" aria-live="polite">
          <div className="empty-emoji" aria-hidden>🖼️</div>
          <div className="empty-title">No Images In Campaign</div>
          <div className="empty-desc">This campaign has no uploaded images yet.</div>
        </div>
      ) : (
        images.map((img, i) => (
          <div className="card" key={`${img.src}-${i}`}>
            {img.isLoading ? (
              <div className="image-placeholder">
                <div className="placeholder-content">
                  <div className="placeholder-icon">📷</div>
                  <div className="placeholder-text">Loading...</div>
                </div>
              </div>
            ) : (
              <img
                src={img.loadedSrc || img.src || ''}
                alt={img.fileName}
                loading="lazy"
                onClick={(e) => onImageClick(i, e.currentTarget)}
              />
            )}
            <div className="filename">{img.fileName}</div>
          </div>
        ))
      )}
    </section>
  );
});

export default GalleryGrid;
