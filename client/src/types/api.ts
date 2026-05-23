// API Response Types

export interface Campaign {
  id: string;
  hashtag: string;
  episode: string;
  episode_id: string;
  date: string;
  icon_path: string;
  fringenuity_link?: string;
  imdb_link?: string;
  wiki_link?: string;
}

// API returns images with valid src URLs
export interface ApiImageData {
  fileName: string;
  src: string;
  // Populated by the server's attribution enrichment. Optional + nullable so
  // the client stays defensive against older responses or unresolved authors.
  author?: ImageAuthor | null;
}

// Our internal state can have loading states with null src
export interface ImageData {
  fileName: string;
  src: string | null; // Allow null during loading states
  originalSrc?: string;
  isLoading?: boolean;
  loadedSrc?: string | null;
  // Carried through from the server's attribution enrichment so the lightbox
  // AUTHOR row can render without an extra lookup.
  author?: ImageAuthor | null;
}

export interface BuildInfo {
  repoUrl: string | null;
  commitHash: string | null;
  builtAt: string | null;
}

// API Response interfaces
export interface CampaignsResponse {
  campaigns: Campaign[];
}

export interface CampaignImagesResponse {
  images: ApiImageData[];
}

export type BuildInfoResponse = BuildInfo;

// ContentPage is derived from VALID_CONTENT_PAGES in shared/types.ts.
// To add a new page: add its slug to VALID_CONTENT_PAGES in shared/types.ts —
// the type and server validation stay in sync automatically.
import type {
  ContentPage,
  AttributionConfidence,
  ImageAuthor,
  Author,
  AuthorWithCount,
} from '../../../shared/types';
export type { ContentPage, AttributionConfidence, ImageAuthor, Author, AuthorWithCount };

export interface ContentResponse {
  content: string;
  page: ContentPage;
}

// Response from GET /api/authors — list of known authors with image counts.
export interface AuthorsResponse {
  authors: AuthorWithCount[];
}

// Response from GET /api/authors/:handle — the author plus their images.
export interface AuthorDetailResponse {
  author: Author;
  images: Array<{
    src: string;
    fileName: string;
    blobPath: string;
    campaignId: string;
    confidence: AttributionConfidence;
  }>;
}
