import React from 'react';
import type { Campaign, ImageAuthor } from '../types/api';
import { UNKNOWN_ARTIST_HANDLE, UNKNOWN_ARTIST_NAME } from '../types/api';
import { parseEpisodeId } from '../utils/parseEpisodeId';
import { extractImdbId } from '../utils/extractImdbId';
import { isSafeUrl } from '../utils/isSafeUrl';
import { getInitials } from '../utils/author';

interface Props {
  campaign: Campaign | null;
  author?: ImageAuthor | null;
  /**
   * When provided, the resolved-author handle renders as an in-app navigation
   * button that invokes this callback with the (raw, unencoded) handle. The
   * caller is expected to close the lightbox and navigate to the author's
   * gallery page. When omitted, the handle is rendered as plain text (or, when
   * a safe twitterUrl is available, as the legacy external link) — used by
   * tests and any context where in-app author navigation isn't applicable.
   */
  onOpenAuthorGallery?: (handle: string) => void;
  /**
   * Called when the user activates the EPISODE NAME affordance. Receives the
   * id of the image's source campaign. The handler is expected to close the
   * lightbox and, if the gallery isn't already showing that campaign, switch
   * to it. When omitted, the EPISODE NAME value renders as plain text.
   *
   * The callback signature takes a campaignId (rather than capturing the
   * current `campaign.id` internally) so it stays correct once the lightbox
   * begins displaying images from different campaigns — i.e. author-browse
   * mode in fringematrix5-ik5.
   */
  onOpenCampaignGallery?: (campaignId: string) => void;
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
 * Renders the AUTHOR row content based on the states defined in
 * fringematrix5-5s8 + fringematrix5-0y9l:
 *   1. Resolved (handle present, confidence 'high' | 'medium')
 *   2. Unresolved (handle is null on the attribution record, regardless of
 *      whether candidates exist) → render a single "unknown" affordance that
 *      links to the synthetic Unknown artist gallery (`#authors/__unknown__`).
 *      The previous "Possibly: @A, @B" candidate list was removed in
 *      fringematrix5-0y9l; the Unknown artist page collects every
 *      attribution record whose handle is null, so the lightbox now points
 *      users there instead of repeating uncertain candidate guesses.
 *   3. No attribution data at all (author null) → return null so the caller
 *      can omit the row entirely.
 */
function AuthorRow({
  author,
  onOpenAuthorGallery,
}: {
  author: ImageAuthor;
  onOpenAuthorGallery?: (handle: string) => void;
}) {
  // Case 1: resolved (we have a handle).
  if (author.handle) {
    const initials = getInitials(author.handle) || '?';
    const isMedium = author.confidence === 'medium';
    const hasSafeUrl = isSafeUrl(author.twitterUrl);
    const handle = author.handle;

    // Design choice: when in-app navigation is available, the handle text
    // becomes a button that navigates to the author's gallery page. The
    // external Twitter link is preserved as a small icon-only link next to
    // it, so users keep both affordances. When the callback isn't provided
    // (legacy / test contexts), fall back to the previous render: the entire
    // handle is the external link, or plain text when no safe URL exists.
    const handleNode = onOpenAuthorGallery ? (
      <button
        type="button"
        className="lightbox-details-link lightbox-author-handle lightbox-author-handle--button"
        onClick={() => onOpenAuthorGallery(handle)}
      >
        {handle}
      </button>
    ) : hasSafeUrl && author.twitterUrl ? (
      <a
        className="lightbox-details-link lightbox-author-handle"
        href={author.twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {handle}
        <span className="lightbox-details-external" aria-hidden={true}>↗</span>
        <span className="visually-hidden"> (opens in new tab)</span>
      </a>
    ) : (
      <span className="lightbox-author-handle">{handle}</span>
    );

    return (
      <div className="lightbox-details-row lightbox-details-author">
        <div className="lightbox-details-label">ARTIST</div>
        <div className="lightbox-details-value lightbox-details-author-value">
          <span
            className="lightbox-author-avatar"
            aria-hidden={true}
            title={author.displayName ?? undefined}
          >
            {initials}
          </span>
          {handleNode}
          {onOpenAuthorGallery && hasSafeUrl && author.twitterUrl ? (
            <a
              className="lightbox-details-link lightbox-author-twitter"
              href={author.twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${handle} on Twitter (opens in new tab)`}
            >
              <span className="lightbox-details-external" aria-hidden={true}>↗</span>
            </a>
          ) : null}
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

  // Case 2: unresolved (handle is null). Both sub-cases — "no handle +
  // candidates" and "no handle + no candidates" — collapse into a single
  // "unknown" affordance that links to the synthetic Unknown artist gallery
  // (`#authors/__unknown__`). See fringematrix5-0y9l: we no longer surface
  // the candidate list in the lightbox; users follow the link to browse all
  // unattributed images instead.
  //
  // The unknown link uses the same in-app navigation hook as the resolved
  // case (`onOpenAuthorGallery`) — the App-level handler closes the lightbox
  // and pushes the author-detail hash. When no callback is provided
  // (legacy / test contexts) we fall back to a plain '?' affordance with
  // the unknown label rendered as static text so the row is still
  // informative without dangling navigation.
  const unknownLabel = `${UNKNOWN_ARTIST_NAME.toLowerCase()}`;
  return (
    <div className="lightbox-details-row lightbox-details-author">
      <div className="lightbox-details-label">ARTIST</div>
      <div className="lightbox-details-value lightbox-details-author-value">
        <span
          className="lightbox-author-avatar lightbox-author-avatar--unresolved"
          aria-hidden={true}
        >
          ?
        </span>
        {onOpenAuthorGallery ? (
          <button
            type="button"
            className="lightbox-details-link lightbox-author-handle lightbox-author-handle--button lightbox-author-unknown"
            onClick={() => onOpenAuthorGallery(UNKNOWN_ARTIST_HANDLE)}
            aria-label={`View all images by ${UNKNOWN_ARTIST_NAME}`}
          >
            {unknownLabel}
          </button>
        ) : (
          <span className="lightbox-author-unknown">{unknownLabel}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the IMAGE DETAILS sidebar content: episode name, season/number,
 * air date, hashtag, IMDB link, and the AUTHOR row when attribution data is
 * available (see fringematrix5-5s8).
 *
 * The AUTHOR row is conditionally rendered based on the `author` prop:
 *   - high/medium confidence → handle as link (with avatar + optional badge)
 *   - unresolved (handle null, with or without candidates) → "unknown" link
 *     to the synthetic Unknown artist gallery (fringematrix5-0y9l)
 *   - author === null (no attribution data) → row is omitted entirely
 *
 * If no active campaign is available the component renders a single
 * empty-state line so the sidebar is not a confusing blank panel.
 *
 * Wrapped in React.memo so that both instances rendered by LightboxContainer
 * (inline sidebar + mobile drawer) skip re-computation when the campaign and
 * author props haven't changed — e.g. during prev/next image navigation
 * within the same campaign.
 */
function LightboxDetails({ campaign, author, onOpenAuthorGallery, onOpenCampaignGallery }: Props) {
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

  const campaignId = campaign.id;
  const handleOpenCampaign = onOpenCampaignGallery
    ? () => onOpenCampaignGallery(campaignId)
    : null;

  return (
    <>
      <div className="lightbox-details-heading">IMAGE DETAILS</div>
      <Row label="EPISODE NAME">
        {handleOpenCampaign ? (
          // Intentionally NOT given the `lightbox-details-link` class — that
          // class is shared with external <a> anchors (e.g. IMDB) and an
          // e2e test (lightbox-redesign.spec.ts) relies on it identifying
          // the external link via `.first()`. We use a dedicated class
          // here and inline the link-like styling in styles.css.
          <button
            type="button"
            className="lightbox-details-campaign-link"
            onClick={handleOpenCampaign}
            aria-label={`View campaign gallery for ${campaign.episode}`}
          >
            {campaign.episode}
          </button>
        ) : (
          campaign.episode
        )}
      </Row>
      <Row label="SEASON / NUMBER">{seasonNumberLabel}</Row>
      <Row label="AIR DATE">{campaign.date}</Row>
      <Row label="HASHTAG">
        {handleOpenCampaign ? (
          // Same hoisting pattern as EPISODE NAME: reuse the memoized
          // `handleOpenCampaign` closure (computed once per campaign change)
          // so React.memo on LightboxDetails keeps working across prev/next
          // image navigation. Reuse the existing `.lightbox-details-campaign-link`
          // class for visual parity with the EPISODE NAME affordance.
          //
          // Design choice: the `#` prefix lives INSIDE the button so the
          // entire visible hashtag (including the sigil that visually
          // identifies it as a hashtag) is a single uninterrupted click
          // target.
          <button
            type="button"
            className="lightbox-details-campaign-link"
            onClick={handleOpenCampaign}
            aria-label={`View campaign gallery for #${campaign.hashtag}`}
          >
            {`#${campaign.hashtag}`}
          </button>
        ) : (
          `#${campaign.hashtag}`
        )}
      </Row>
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
      {author ? <AuthorRow author={author} onOpenAuthorGallery={onOpenAuthorGallery} /> : null}
    </>
  );
}

export default React.memo(LightboxDetails);
