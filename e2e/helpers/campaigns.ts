import type { APIRequestContext } from '@playwright/test';

export interface CampaignSummary {
  id: string;
  hashtag: string;
  episode: string;
  episode_id: string;
  icon_path: string;
}

/**
 * Fetch the campaign list straight from the API so specs can compute the
 * expected heading / hash for a given campaign index without scraping the UI.
 * `/api/campaigns` is served from data/campaigns.yaml (no Blob calls), so this
 * is cheap and works even without BLOB_READ_WRITE_TOKEN.
 */
export async function fetchCampaigns(request: APIRequestContext): Promise<CampaignSummary[]> {
  const res = await request.get('/api/campaigns');
  if (!res.ok()) throw new Error(`/api/campaigns returned ${res.status()}`);
  const body = (await res.json()) as { campaigns?: CampaignSummary[] };
  return body.campaigns ?? [];
}
