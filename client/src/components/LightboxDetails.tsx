import React from 'react';
import type { Campaign, ImageAuthor } from '../types/api';
import { parseEpisodeId } from '../utils/parseEpisodeId';
import { extractImdbId } from '../utils/extractImdbId';
import { isSafeUrl } from '../utils/isSafeUrl';
import { getInitials } from '../utils/author';

interface Props {
  campaign: Campaign | null;
  author?: ImageAuthor | null;
}

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div className="lightbox-details-row">
      <div className="lightbox-details-label">{label}</div>
      <div className="lightbox-details-value">{children}</div>
    </div>
  );
}

/**
 * Renders the AUTHOR row content based on the three states defined in
 * fringematrix5-5s8:
 *   1. Resolved (handle present, confidence 'high' | 'medium')
 *   2. Unresolved (handle null, candidates.length > 0)
 *   3. No data (author null OR handle null AND no candidates) → return null
 *      so the caller can omit the row entirely.
 */
function AuthorRow({ author }: { author: ImageAuthor }) {
  // Case 1: resolved (we have a handle).
  if (author.handle) {
    const initials = getInitials(author.handle) || '?';
    const isMedium = author.confidence === 'medium';
    const hasSafeUrl = isSafeUrl(author.twitterUrl);
    return (
      <div className="lightbox-details-row lightbox-details-author">
        <div className="lightbox-details-label">AUTHOR</div>
        <div className="lightbox-details-value lightbox-details-author-value">
          <span
            className="lightbox-author-avatar"
            aria-hidden={true}
            title={author.displayName ?? undefined}
          >
            {initials}
          </span>
          {hasSafeUrl && author.twitterUrl ? (
            <a
              className="lightbox-details-link lightbox-author-handle"
              href={author.twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {author.handle}
              <span className="lightbox-details-external" aria-hidden={true}>↗</span>
              <span className="visually-hidden"> (opens in new tab)</span>
            </a>
          ) : (
            <span className="lightbox-author-handle">{author.handle}</span>
          )}
          {isMedium ? (
            <span
              className="lightbox-author-badge"
              title="Attribution uncertain"
              aria-label="Attribution uncertain"
            >
              uncertain
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // Case 2: unresolved with candidates.
  if (author.candidates && author.candidates.length > 0) {
    return (
      <div className="lightbox-details-row lightbox-details-author">
        <div className="lightbox-details-label">AUTHOR</div>
        <div className="lightbox-details-value lightbox-details-author-value">
          <span
            className="lightbox-author-avatar lightbox-author-avatar--unresolved"
            aria-hidden={true}
          >
            ?
          </span>
          <span className="lightbox-author-candidates">
            Possibly: {author.candidates.join(', ')}
          </span>
        </div>
      </div>
    );
  }

  // Case 3: no data → omit (handled by the caller).
  return null;
}

/**
 * Renders the IMAGE DETAILS sidebar content: episode name, season/number,
 * air date, hashtag, IMDB link, and the AUTHOR row when attribution data is
 * available (see fringematrix5-5s8).
 *
 * The AUTHOR row is conditionally rendered based on the `author` prop:
 *   - high/medium confidence → handle as link (with avatar + optional badge)
 *   - unresolved with candidates → "Possibly: @A, @B" with a '?' avatar
 *   - null / no candidates → row is omitted entirely
 *
 * If no active campaign is available the component renders a single
 * empty-state line so the sidebar is not a confusing blank panel.
 *
 * Wrapped in React.memo so that both instances rendered by LightboxContainer
 * (inline sidebar + mobile drawer) skip re-computation when the campaign and
 * author props haven't changed — e.g. during prev/next image navigation
 * within the same campaign.
 */
function LightboxDetails({ campaign, author }: Props) {
  if (!campaign) {
    return (
      <>
        <div className="lightbox-details-heading">IMAGE DETAILS</div>
        <div className="lightbox-details-empty">No campaign selected.</div>
      </>
    );
  }

  const parsed = parseEpisodeId(campaign.episode_id);
  const seasonNumberLabel = parsed ? parsed.label : campaign.episode_id;
  const imdbId = extractImdbId(campaign.imdb_link);
  const imdbLinkText = imdbId ?? campaign.imdb_link ?? null;

  return (
    <>
      <div className="lightbox-details-heading">IMAGE DETAILS</div>
      <Row label="EPISODE NAME">{campaign.episode}</Row>
      <Row label="SEASON / NUMBER">{seasonNumberLabel}</Row>
      <Row label="AIR DATE">{campaign.date}</Row>
      <Row label="HASHTAG">{`#${campaign.hashtag}`}</Row>
      {isSafeUrl(campaign.imdb_link) && imdbLinkText ? (
        <Row label="IMDB">
          <a
            className="lightbox-details-link"
            href={campaign.imdb_link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {imdbLinkText}
            <span className="lightbox-details-external" aria-hidden={true}>↗</span>
            <span className="visually-hidden"> (opens in new tab)</span>
          </a>
        </Row>
      ) : null}
      {author ? <AuthorRow author={author} /> : null}
    </>
  );
}

export default React.memo(LightboxDetails);
