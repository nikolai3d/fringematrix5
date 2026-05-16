import React from 'react';
import type { Campaign } from '../types/api';
import { parseEpisodeId } from '../utils/parseEpisodeId';
import { extractImdbId } from '../utils/extractImdbId';
import { isSafeUrl } from '../utils/isSafeUrl';

interface Props {
  campaign: Campaign | null;
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
 * Renders the IMAGE DETAILS sidebar content (episode name, season/number,
 * air date, hashtag, IMDB link). AUTHOR row is intentionally omitted —
 * tracked in fringematrix5-qyr until an author data source is decided.
 *
 * If no active campaign is available the component renders a single
 * empty-state line so the sidebar is not a confusing blank panel.
 *
 * Wrapped in React.memo so that both instances rendered by LightboxContainer
 * (inline sidebar + mobile drawer) skip re-computation when the campaign prop
 * hasn't changed — e.g. during prev/next image navigation.
 */
function LightboxDetails({ campaign }: Props) {
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
    </>
  );
}

export default React.memo(LightboxDetails);
