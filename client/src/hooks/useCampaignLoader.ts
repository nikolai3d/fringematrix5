import { useState, useCallback, useRef, MutableRefObject } from 'react';
import { fetchJSON } from '../utils/fetchJSON';
import type {
  ImageData,
  ApiImageData,
  CampaignImagesResponse,
} from '../types/api';

// A single hung image shouldn't freeze the whole gallery. After this much
// time we treat the image as errored and let the rest of the batch finish.
const IMAGE_PRELOAD_TIMEOUT_MS = 15_000;

async function preloadCampaignImages(
  campaignImages: ApiImageData[],
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<{ hasError: boolean }> {
  let loaded = 0;
  let hasError = false;
  await Promise.all(
    campaignImages.map((img) =>
      new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        const image = new Image();
        let settled = false;
        // Abort short-circuits the wait so rapid campaign switching doesn't
        // leave dozens of pending Image loads holding the Promise.all open
        // for the full 15s timeout each.
        const settle = (errored: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          if (signal.aborted) return resolve();
          if (errored) hasError = true;
          loaded += 1;
          onProgress(loaded);
          resolve();
        };
        const onAbort = () => settle(false);
        signal.addEventListener('abort', onAbort);
        const timer = setTimeout(() => settle(true), IMAGE_PRELOAD_TIMEOUT_MS);
        image.onload = () => settle(false);
        image.onerror = () => settle(true);
        image.src = img.src;
      }),
    ),
  );
  return { hasError };
}

export interface CampaignLoaderState {
  currentImages: ImageData[];
  isCampaignLoading: boolean;
  campaignLoadProgress: number;
  campaignLoadTotal: number;
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
  const [campaignLoadProgress, setCampaignLoadProgress] = useState<number>(0);
  const [campaignLoadTotal, setCampaignLoadTotal] = useState<number>(0);
  const [campaignLoadError, setCampaignLoadError] = useState<boolean>(false);
  const campaignLoadAbortRef = useRef<AbortController | null>(null);

  // Fetches a campaign's images and preloads them, writing progress/error
  // state along the way. Shared by selectCampaign and the initial mount-load
  // effect — keep both call sites in sync by editing here.
  const loadCampaignImages = useCallback(async (
    id: string,
    signal: AbortSignal,
    onImageCountKnown?: (count: number) => void,
  ): Promise<void> => {
    setIsCampaignLoading(true);
    setCampaignLoadProgress(0);
    setCampaignLoadTotal(0);
    setCampaignLoadError(false);

    try {
      const res = await fetchJSON<CampaignImagesResponse>(`/api/campaigns/${id}/images`, { signal });
      if (signal.aborted) return;
      const campaignImages = res.images || [];

      setCampaignLoadTotal(campaignImages.length);
      onImageCountKnown?.(campaignImages.length);

      if (campaignImages.length === 0) {
        setCurrentImages([]);
        return;
      }

      const placeholderImages = campaignImages.map((img: ApiImageData) => ({
        fileName: img.fileName,
        originalSrc: img.src,
        src: null,
        isLoading: true,
        loadedSrc: null
      }));
      setCurrentImages(placeholderImages);

      const { hasError } = await preloadCampaignImages(campaignImages, signal, setCampaignLoadProgress);
      if (signal.aborted) return;

      if (hasError) setCampaignLoadError(true);

      const fullyLoadedImages = campaignImages.map((img: ApiImageData) => ({
        ...img,
        isLoading: false,
        loadedSrc: img.src
      }));

      setCurrentImages(fullyLoadedImages);
      setImageCache(prev => ({ ...prev, [id]: fullyLoadedImages }));
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
      setCampaignLoadProgress(0);
      setCampaignLoadTotal(0);
      setCampaignLoadError(false);
      setIsCampaignLoading(false);
      return;
    }

    await loadCampaignImages(id, signal);
  }, [imageCache, loadCampaignImages]);

  return {
    currentImages,
    isCampaignLoading,
    campaignLoadProgress,
    campaignLoadTotal,
    campaignLoadError,
    campaignLoadAbortRef,
    loadCampaignImages,
    selectCampaign,
  };
}
