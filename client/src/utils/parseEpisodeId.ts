export interface ParsedEpisodeId {
  season: number;
  episode: number;
  label: string;
}

const EPISODE_ID_PATTERN = /^(\d+)\.(\d+)$/;

export function parseEpisodeId(episodeId: string | null | undefined): ParsedEpisodeId | null {
  if (!episodeId || typeof episodeId !== 'string') return null;
  const match = episodeId.match(EPISODE_ID_PATTERN);
  if (!match) return null;
  const season = Number(match[1]);
  const episode = Number(match[2]);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return null;
  const paddedEpisode = String(episode).padStart(2, '0');
  const label = `S${season} · E${paddedEpisode} (${episodeId})`;
  return { season, episode, label };
}
