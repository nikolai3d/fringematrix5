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
}

// Our internal state can have loading states with null src
export interface ImageData {
  fileName: string;
  src: string | null; // Allow null during loading states
  originalSrc?: string;
  isLoading?: boolean;
  loadedSrc?: string | null;
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

export interface BuildInfoResponse extends BuildInfo {}