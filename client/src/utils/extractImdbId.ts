/**
 * Extracts an IMDB title id (e.g. "tt2125636") from a full IMDB URL.
 * Returns null if the URL does not contain a recognisable title segment.
 */
export function extractImdbId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/(tt\d+)(?:[/?#]|$)/);
  return match ? match[1] : null;
}
