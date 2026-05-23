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
  // Stable on-disk identifier (e.g. "avatars/Season4/CrossTheLine/abc.jpg").
  // Optional for defensive compatibility with older responses; the campaign
  // images endpoint always populates it.
  blobPath?: string;
  // Populated by the server's attribution enrichment. Optional + nullable so
  // the client stays defensive against older responses or unresolved authors.
  author?: ImageAuthor | null;
  // Source campaign id for the image. Author-detail responses populate this
  // server-side so the lightbox can resolve the source campaign per-image when
  // browsing across campaigns. Campaign-image responses do NOT populate this
  // field; the client populates it from the active campaign id when mapping
  // ApiImageData -> ImageData.
  campaignId?: string;
}

// Our internal state can have loading states with null src
export interface ImageData {
  fileName: string;
  src: string | null; // Allow null during loading states
  originalSrc?: string;
  isLoading?: boolean;
  loadedSrc?: string | null;
  // Stable on-disk identifier carried from the server response so we can match
  // a specific image across views (e.g. opening the lightbox at the right
  // image after navigating from the authors page).
  blobPath?: string;
  // Carried through from the server's attribution enrichment so the lightbox
  // AUTHOR row can render without an extra lookup.
  author?: ImageAuthor | null;
  // Source campaign id for the image. Populated for both campaign-mode
  // (from the active campaign id) and author-mode (from the author detail
  // response). Optional + defensive: lightbox consumers that need it must
  // tolerate older responses where it is missing.
  campaignId?: string;
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

// Discriminated union describing the image list currently being browsed in
// the lightbox. The lightbox itself only cares about the `images` array for
// prev/next/swipe/arrow/counter behavior — the `kind` + extra fields let
// downstream consumers (e.g. LightboxDetails) resolve view-specific context
// such as the source campaign or the originating author handle.
//
// Today the App opens the lightbox in `campaign` mode from the gallery grid.
// `author` mode is reserved for the upcoming author-browse flow (filed under
// fringematrix5-ik5) where the user pages through one author's images across
// multiple campaigns.
export type LightboxImageSource =
  | { kind: 'campaign'; images: ImageData[]; campaignId: string }
  | { kind: 'author'; images: ImageData[]; handle: string };
