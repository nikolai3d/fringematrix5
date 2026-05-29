import { useState, useCallback, useRef, MutableRefObject } from 'react';
import { fetchJSON } from '../utils/fetchJSON';
import type {
  ImageData,
  ApiImageData,
  CampaignImagesResponse,
} from '../types/api';

// Origins we've already injected a <link rel="preconnect"> for, so we only do
// it once per CDN host for the lifetime of the page.
const preconnectedOrigins = new Set<string>();

// Warm the TLS connection to the Blob CDN before the gallery's <img> tags
// begin fetching. The real image origin is a per-store wildcard subdomain
// (https://<store>.public.blob.vercel-storage.com) that isn't known until the
// first image URL arrives, so we derive it at runtime and inject a one-time
// preconnect <link>. Malformed URLs are ignored.
function preconnectToOrigin(sampleUrl: string): void {
  if (typeof document === 'undefined') return;
  try {
    const { origin } = new URL(sampleUrl);
    if (preconnectedOrigins.has(origin)) return;
    preconnectedOrigins.add(origin);
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  } catch {
    // Ignore malformed image URLs — preconnect is a best-effort optimization.
  }
}

export interface CampaignLoaderState {
  currentImages: ImageData[];
  isCampaignLoading: boolean;
  campaignLoadError: boolean;
  campaignLoadAbortRef: MutableRefObject<AbortController | null>;
  loadCampaignImages: (
    id: string,
    signal: AbortSignal,
    onImageCountKnown?: (count: number) => void,
  ) => Promise<void>;
  selectCampaign: (id: string, onNavigate: (id: string) => void) => Promise<void>;
}

export function useCampaignLoader(): CampaignLoaderState {
  const [currentImages, setCurrentImages] = useState<ImageData[]>([]);
  const [imageCache, setImageCache] = useState<Record<string, ImageData[]>>({});
  const [isCampaignLoading, setIsCampaignLoading] = useState<boolean>(false);
  const [campaignLoadError, setCampaignLoadError] = useState<boolean>(false);
  const campaignLoadAbortRef = useRef<AbortController | null>(null);

  // Fetches a campaign's image list and shows the grid immediately — the
  // browser streams thumbnails in natively via <img loading="lazy">, so we no
  // longer block on downloading every image first. Shared by selectCampaign
  // and the initial mount-load effect; keep both call sites in sync by editing
  // here.
  const loadCampaignImages = useCallback(async (
    id: string,
    signal: AbortSignal,
    onImageCountKnown?: (count: number) => void,
  ): Promise<void> => {
    setIsCampaignLoading(true);
    setCampaignLoadError(false);

    try {
      const res = await fetchJSON<CampaignImagesResponse>(`/api/campaigns/${id}/images`, { signal });
      if (signal.aborted) return;
      const campaignImages = res.images || [];

      onImageCountKnown?.(campaignImages.length);

      if (campaignImages.length === 0) {
        setCurrentImages([]);
        return;
      }

      // Warm the CDN TLS connection now (during the loading-screen fade) so the
      // first thumbnails fetch over an already-open connection.
      preconnectToOrigin(campaignImages[0].src);

      // Build the final ImageData in a single pass — no placeholder → loaded
      // swap. src/loadedSrc carry the real CDN URL so the grid renders right
      // away. blobPath/author come from the API response; campaignId is stamped
      // from the active load's `id` (the API doesn't echo it in the response
      // body — it's already in the request path) so the lightbox can resolve
      // the source campaign per-image without an extra lookup.
      const images: ImageData[] = campaignImages.map((img: ApiImageData) => ({
        ...img,
        originalSrc: img.src,
        loadedSrc: img.src,
        isLoading: false,
        campaignId: id,
      }));

      setCurrentImages(images);
      setImageCache(prev => ({ ...prev, [id]: images }));
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      console.error('Failed to load campaign images:', error);
      setCampaignLoadError(true);
      setCurrentImages([]);
    } finally {
      if (!signal.aborted) setIsCampaignLoading(false);
    }
  }, []);

  // onNavigate is called to update the active campaign ID and URL hash in App.
  // This keeps routing concerns in App while loading concerns live here.
  const selectCampaign = useCallback(async (
    id: string,
    onNavigate: (id: string) => void,
  ) => {
    // All nav buttons are disabled while isCampaignLoading is true, so
    // user-triggered calls to selectCampaign cannot overlap with an ongoing
    // user-triggered load. The abort here is intentionally kept for one real
    // race: the initial mount-load (which runs before buttons are rendered)
    // overlapping with the first user click once the loading screen clears.
    // Removing the abort would leave that mount → user-click transition
    // unguarded, so we keep it even though it is a no-op for all other paths.
    campaignLoadAbortRef.current?.abort();
    const controller = new AbortController();
    campaignLoadAbortRef.current = controller;
    const { signal } = controller;

    onNavigate(id);

    if (id in imageCache) {
      setCurrentImages(imageCache[id]);
      setCampaignLoadError(false);
      setIsCampaignLoading(false);
      return;
    }

    await loadCampaignImages(id, signal);
  }, [imageCache, loadCampaignImages]);

  return {
    currentImages,
    isCampaignLoading,
    campaignLoadError,
    campaignLoadAbortRef,
    loadCampaignImages,
    selectCampaign,
  };
}
