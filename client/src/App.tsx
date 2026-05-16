import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useLightboxAnimations } from './hooks/useLightboxAnimations';
import { useFocusTrap } from './hooks/useFocusTrap';
import { fetchJSON } from './utils/fetchJSON';
import { formatTimePacific } from './utils/formatTimePacific';
import { gitRemoteToHttps } from './utils/gitRemoteToHttps';
import { closeSubwindowsState } from './utils/closeSubwindowsState';
import { applyTheme } from './config/theme';
import LoadingManager from './components/LoadingManager';
import CampaignNavigation from './components/CampaignNavigation';
import ContentModal from './components/ContentModal';
import LightboxContainer from './components/LightboxContainer';
import type {
  Campaign,
  ImageData,
  ApiImageData,
  BuildInfo,
  CampaignsResponse,
  CampaignImagesResponse,
  BuildInfoResponse,
  ContentPage,
  ContentResponse
} from './types/api';

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

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [imagesByCampaign, setImagesByCampaign] = useState<Record<string, ImageData[]>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [hideLightboxImage, setHideLightboxImage] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [isPreloading, setIsPreloading] = useState<boolean>(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState<boolean>(true);
  const [loadingCampaignCount, setLoadingCampaignCount] = useState<number | null>(null);
  const [loadingImageCount, setLoadingImageCount] = useState<number | null>(null);
  const [isDataReady, setIsDataReady] = useState<boolean>(false);
  const [loadingDots, setLoadingDots] = useState<number>(0);
  const [loadingError, setLoadingError] = useState<boolean>(false);
  const [isCampaignLoading, setIsCampaignLoading] = useState<boolean>(false);
  const [campaignLoadProgress, setCampaignLoadProgress] = useState<number>(0);
  const [campaignLoadTotal, setCampaignLoadTotal] = useState<number>(0);
  const [campaignLoadError, setCampaignLoadError] = useState<boolean>(false);
  const campaignLoadAbortRef = useRef<AbortController | null>(null);
  const shareBtnRef = useRef<HTMLButtonElement>(null);
  const buildBtnRef = useRef<HTMLButtonElement>(null);
  const [shareStyle, setShareStyle] = useState<React.CSSProperties>({});
  const [buildStyle, setBuildStyle] = useState<React.CSSProperties>({});
  // Content modal state (History, Credits, Legal).
  // The focus-management contract lives inside ContentModal; this component
  // owns the data and trigger-element for focus restoration on close.
  const [activeModal, setActiveModal] = useState<ContentPage | null>(null);
  const [modalContent, setModalContent] = useState<string>('');
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false);
  // Accessibility settings
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [reduceEffects, setReduceEffects] = useState<boolean>(false);
  // Settings modal refs for focus management
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const modalLoadAbortRef = useRef<AbortController | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

  // Apply theme CSS variables on mount
  useEffect(() => {
    applyTheme();
  }, []);

  // Load accessibility settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('fringematrix-a11y');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.reduceMotion === 'boolean') setReduceMotion(parsed.reduceMotion);
        if (typeof parsed.reduceEffects === 'boolean') setReduceEffects(parsed.reduceEffects);
      }
    } catch { /* ignore corrupt localStorage */ }
  }, []);

  // Apply accessibility classes to <html> and persist to localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', reduceMotion);
    root.classList.toggle('reduce-effects', reduceEffects);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('fringematrix-a11y', JSON.stringify({ reduceMotion, reduceEffects }));
    } catch { /* ignore storage errors */ }
  }, [reduceMotion, reduceEffects]);

  const repoHref = useMemo(
    () => gitRemoteToHttps(buildInfo?.repoUrl || ''),
    [buildInfo?.repoUrl]
  );

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) || null,
    [campaigns, activeCampaignId]
  );

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
        setImages([]);
        return;
      }

      const placeholderImages = campaignImages.map((img: ApiImageData) => ({
        fileName: img.fileName,
        originalSrc: img.src,
        src: null,
        isLoading: true,
        loadedSrc: null
      }));
      setImages(placeholderImages);

      const { hasError } = await preloadCampaignImages(campaignImages, signal, setCampaignLoadProgress);
      if (signal.aborted) return;

      if (hasError) setCampaignLoadError(true);

      const fullyLoadedImages = campaignImages.map((img: ApiImageData) => ({
        ...img,
        isLoading: false,
        loadedSrc: img.src
      }));

      setImages(fullyLoadedImages);
      setImagesByCampaign(prev => ({ ...prev, [id]: fullyLoadedImages }));
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      console.error('Failed to load campaign images:', error);
      setCampaignLoadError(true);
      setImages([]);
    } finally {
      if (!signal.aborted) setIsCampaignLoading(false);
    }
  }, []);

  const selectCampaign = useCallback(async (id: string) => {
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

    setActiveCampaignId(id);
    window.history.replaceState({}, '', `#${id}`);

    if (imagesByCampaign[id]) {
      setImages(imagesByCampaign[id]);
      setCampaignLoadProgress(0);
      setCampaignLoadTotal(0);
      setCampaignLoadError(false);
      setIsCampaignLoading(false);
      return;
    }

    await loadCampaignImages(id, signal);
  }, [imagesByCampaign, loadCampaignImages]);

  const activeIndex = useMemo(() => {
    if (!activeCampaignId) return -1;
    return campaigns.findIndex((c) => c.id === activeCampaignId);
  }, [campaigns, activeCampaignId]);

  const goToNextCampaign = useCallback(() => {
    if (!campaigns.length) return;
    const nextIdx = activeIndex < 0 ? 0 : (activeIndex + 1) % campaigns.length;
    const next = campaigns[nextIdx];
    if (next) selectCampaign(next.id);
  }, [campaigns, activeIndex, selectCampaign]);

  const goToPrevCampaign = useCallback(() => {
    if (!campaigns.length) return;
    const prevIdx = activeIndex < 0 ? campaigns.length - 1 : (activeIndex - 1 + campaigns.length) % campaigns.length;
    const prev = campaigns[prevIdx];
    if (prev) selectCampaign(prev.id);
  }, [campaigns, activeIndex, selectCampaign]);

  const toggleSidebar = useCallback(() => setIsSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const toggleBuildInfo = useCallback(async () => {
    setIsBuildInfoOpen((wasOpen) => {
      const next = !wasOpen;
      if (next && buildBtnRef.current) {
        const r = buildBtnRef.current.getBoundingClientRect();
        setBuildStyle({ top: Math.round(r.bottom + 8), left: Math.round(r.left) });
      }
      return next;
    });
    setIsShareOpen(false);
    if (!buildInfo) {
      try {
        const data = await fetchJSON<BuildInfoResponse>('/api/build-info');
        setBuildInfo(data);
      } catch (e) {
        console.error(e);
        setBuildInfo({ repoUrl: null, commitHash: null, builtAt: null });
      }
    }
  }, [buildInfo]);

  const toggleShare = useCallback(() => {
    setIsShareOpen((wasOpen) => {
      const next = !wasOpen;
      if (next && shareBtnRef.current) {
        const r = shareBtnRef.current.getBoundingClientRect();
        setShareStyle({ top: Math.round(r.bottom + 8), left: Math.round(r.left) });
      }
      return next;
    });
    setIsBuildInfoOpen(false);
  }, []);

  // Opens a content modal (History, Credits, or Legal)
  // Focus Contract: Stores trigger element for later focus restoration (see contract item 1)
  const openModal = useCallback(async (page: ContentPage) => {
    // Cancel any in-flight modal content fetch from a prior open call
    modalLoadAbortRef.current?.abort();
    const controller = new AbortController();
    modalLoadAbortRef.current = controller;
    const { signal } = controller;

    // Close other popovers when opening modal
    setIsBuildInfoOpen(false);
    setIsShareOpen(false);
    setIsSidebarOpen(false);

    // Focus Contract Item 1: Store the trigger element for focus restoration when modal closes
    modalTriggerRef.current = document.activeElement as HTMLElement;

    setActiveModal(page);
    setIsModalLoading(true);
    setModalContent('');

    try {
      const data = await fetchJSON<ContentResponse>(`/api/content/${page}`, { signal });
      if (signal.aborted) return;
      // Sanitize HTML to prevent XSS attacks
      const sanitizedContent = DOMPurify.sanitize(data.content);
      setModalContent(sanitizedContent);
    } catch (e) {
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
      console.error('Failed to load content:', e);
      setModalContent('<p>Failed to load content. Please try again.</p>');
    } finally {
      if (!signal.aborted) {
        setIsModalLoading(false);
      }
    }
  }, []);

  // Closes the content modal and restores focus
  // Focus Contract Items 5-6: Restores focus to trigger, safely handles null trigger
  const closeModal = useCallback(() => {
    modalLoadAbortRef.current?.abort();
    modalLoadAbortRef.current = null;
    setActiveModal(null);
    setModalContent('');
    setIsModalLoading(false);
    // Focus Contract Item 5: Restore focus to the element that triggered the modal
    // Focus Contract Item 6: Safely skip if no trigger element exists
    if (modalTriggerRef.current) {
      modalTriggerRef.current.focus();
      modalTriggerRef.current = null;
    }
  }, []);

  // Stable, throttled scroll/resize handler setup
  const scheduledFrameRef = useRef<number | null>(null);
  const latestOpenStateRef = useRef({ isShareOpen: false, isBuildInfoOpen: false });

  // Keep latest open-state in a ref so the handler can be stable
  useEffect(() => {
    latestOpenStateRef.current.isShareOpen = isShareOpen;
  }, [isShareOpen]);
  useEffect(() => {
    latestOpenStateRef.current.isBuildInfoOpen = isBuildInfoOpen;
  }, [isBuildInfoOpen]);

  const runMeasureAndPosition = useCallback(() => {
    scheduledFrameRef.current = null;
    const { isShareOpen: shareOpen, isBuildInfoOpen: buildOpen } = latestOpenStateRef.current;
    if (shareOpen && shareBtnRef.current) {
      const r = shareBtnRef.current.getBoundingClientRect();
      setShareStyle({ top: Math.round(r.bottom + 8), left: Math.round(r.left) });
    }
    if (buildOpen && buildBtnRef.current) {
      const r = buildBtnRef.current.getBoundingClientRect();
      setBuildStyle({ top: Math.round(r.bottom + 8), left: Math.round(r.left) });
    }
  }, [setShareStyle, setBuildStyle]);

  const onScrollOrResize = useCallback(() => {
    if (scheduledFrameRef.current !== null) return;
    scheduledFrameRef.current = requestAnimationFrame(runMeasureAndPosition);
  }, [runMeasureAndPosition]);

  // Reposition popovers on resize/scroll while open
  // Use rAF to throttle DOM reads/writes to once per frame during scroll
  useEffect(() => {
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    return () => {
      if (scheduledFrameRef.current !== null) cancelAnimationFrame(scheduledFrameRef.current);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize);
    };
  }, [onScrollOrResize]);

  const threadsShareUrl = useMemo(() => {
    const text = 'Check out Fringe Matrix';
    const url = 'https://fringematrix.art';
    return `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  }, []);

  // Handler for when user dismisses the loading screen
  const handleLoadingComplete = useCallback(() => {
    setShowLoadingScreen(false);
    setIsPreloading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsPreloading(true);

        const data = await fetchJSON<CampaignsResponse>('/api/campaigns');
        if (!isMounted) return;
        setCampaigns(data.campaigns || []);

        // Update loading screen with campaign count
        setLoadingCampaignCount((data.campaigns || []).length);

        // Choose initial campaign and load its images
        const hash = window.location.hash.replace('#', '');
        const initial = (data.campaigns || []).find((c: Campaign) => c.id === hash) || (data.campaigns || [])[0];
        
        if (initial) {
          // Mount-time initial campaign load. Shares campaignLoadAbortRef so a
          // user clicking a different campaign before this finishes aborts cleanly.
          const controller = new AbortController();
          campaignLoadAbortRef.current = controller;

          setActiveCampaignId(initial.id);
          window.history.replaceState({}, '', `#${initial.id}`);

          await loadCampaignImages(initial.id, controller.signal, setLoadingImageCount);
          if (isMounted && !controller.signal.aborted) setIsDataReady(true);
        } else {
          // No initial campaign - still mark as ready
          if (isMounted) setIsDataReady(true);
        }

        // Note: We no longer hide the loader here - the loading screen handles that
      } catch (e) {
        console.error(e);
        setLoadingError(true);
        // Mark as ready even on error so user can see error message
        if (isMounted) setIsDataReady(true);
      }
    })();
    return () => {
      isMounted = false;
      campaignLoadAbortRef.current?.abort();
    };
  }, [loadCampaignImages]); // On mount: loadCampaignImages is a stable useCallback([]) so this runs once

  // Animated dots for the CRT loader and campaign-switch progress bar
  useEffect(() => {
    if (!isPreloading && !isCampaignLoading) return;
    const id = setInterval(() => setLoadingDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, [isPreloading, isCampaignLoading]);

  // Lightbox animations are provided by the useLightboxAnimations hook
  const { openLightbox, closeLightbox, isAnimatingRef } = useLightboxAnimations({
    images,
    isLightboxOpen,
    lightboxIndex,
    reduceMotion,
    setLightboxIndex,
    setIsLightboxOpen,
    setHideLightboxImage,
  });

  // Centralized function to close all subwindows - add new subwindows here
  const closeAllSubwindows = useCallback(() => {
    if (isLightboxOpen) closeLightbox();
    // Non-lightbox subwindow state is managed by the shared utility so that
    // the exhaustive setter list lives in one testable place.
    closeSubwindowsState({
      setIsSidebarOpen,
      setIsBuildInfoOpen,
      setIsShareOpen,
      setActiveModal,
      setIsSettingsOpen,
    });
  }, [isLightboxOpen, closeLightbox]);

  const goHome = useCallback(() => {
    if (!campaigns.length) return;
    const firstCampaign = campaigns[0];
    // Close all open subwindows
    closeAllSubwindows();
    // Clear the hash from the URL
    window.history.replaceState({}, '', window.location.pathname);
    // Select the first campaign
    selectCampaign(firstCampaign.id);
  }, [campaigns, selectCampaign, closeAllSubwindows]);

  // Settings modal: close callback with focus restoration
  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
    settingsTriggerRef.current?.focus();
    settingsTriggerRef.current = null;
  }, []);

  // Settings modal: trap Tab and handle Escape via shared hook
  useFocusTrap(isSettingsOpen, settingsModalRef, closeSettings);

  // Settings modal: focus the close button on open
  useEffect(() => {
    if (!isSettingsOpen) return;

    const focusTimer = setTimeout(() => {
      settingsCloseRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [isSettingsOpen]);

  return (
    <div id="app">
      <LoadingManager
        show={showLoadingScreen}
        loadingError={loadingError}
        campaignCount={loadingCampaignCount}
        imageCount={loadingImageCount}
        isDataReady={isDataReady}
        onComplete={handleLoadingComplete}
      />
      {/* Top toolbar with primary actions */}
      <div className="toolbar" role="toolbar" aria-label="Primary actions">
        <div className="toolbar-inner">
          <button
            className="toolbar-button"
            aria-label="Go to home"
            onClick={goHome}
            disabled={isCampaignLoading}
          >
            Home
          </button>
          <button
            className="toolbar-button"
            aria-expanded={isSidebarOpen}
            aria-controls="campaign-sidebar"
            onClick={toggleSidebar}
            disabled={isCampaignLoading}
          >
            Campaigns
          </button>
          <button
            className="toolbar-button"
            ref={shareBtnRef}
            aria-pressed={isShareOpen}
            onClick={toggleShare}
            disabled={isCampaignLoading}
          >
            Share
          </button>
          <button
            className="toolbar-button"
            ref={buildBtnRef}
            aria-pressed={isBuildInfoOpen}
            onClick={toggleBuildInfo}
            disabled={isCampaignLoading}
          >
            Build Info
          </button>
          <button
            className="toolbar-button"
            onClick={() => openModal('history')}
            disabled={isCampaignLoading}
          >
            History
          </button>
          <button
            className="toolbar-button"
            onClick={() => openModal('credits')}
            disabled={isCampaignLoading}
          >
            Credits
          </button>
          <button
            className="toolbar-button"
            onClick={() => openModal('legal')}
            disabled={isCampaignLoading}
          >
            Legal
          </button>
          <button
            className="toolbar-button"
            aria-pressed={isSettingsOpen}
            onClick={(e) => { settingsTriggerRef.current = e.currentTarget; closeAllSubwindows(); setIsSettingsOpen(v => !v); }}
            disabled={isCampaignLoading}
          >
            Settings
          </button>
        </div>
      </div>
      <header className="navbar" id="top-navbar">
        <div className="navbar-inner">
          <button className="nav-arrow" aria-label="Previous campaign" onClick={goToPrevCampaign} disabled={isCampaignLoading}>◀</button>
          <div className="current-campaign" data-testid="current-campaign-top" title={activeCampaign ? `#${activeCampaign.hashtag}` : ''}>
            {activeCampaign ? `#${activeCampaign.hashtag}` : ''}
          </div>
          <button className="nav-arrow" aria-label="Next campaign" onClick={goToNextCampaign} disabled={isCampaignLoading}>▶</button>
        </div>
      </header>

      <div className="campaign-progress-area" role="status" aria-label="Campaign loading status">
        {isCampaignLoading && (
          <div className="campaign-loading-content">
            <div className="campaign-loading-text">
              Loading Images<span className="dots">{'.'.repeat(loadingDots)}</span>
            </div>
            <div className="campaign-progress-container">
              <div className="campaign-progress-bar">
                <div 
                  className="campaign-progress-fill"
                  style={{ width: campaignLoadTotal > 0 ? `${(campaignLoadProgress / campaignLoadTotal) * 100}%` : '0%' }}
                ></div>
              </div>
              <div className="campaign-progress-text">
                {campaignLoadTotal > 0 ? `${campaignLoadProgress} / ${campaignLoadTotal} loaded` : 'Preparing...'}
              </div>
            </div>
            {campaignLoadError && (
              <div className="campaign-error-text">
                Some images failed to load
              </div>
            )}
          </div>
        )}
      </div>

      <CampaignNavigation
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        isOpen={isSidebarOpen}
        isCampaignLoading={isCampaignLoading}
        onSelect={selectCampaign}
        onClose={closeSidebar}
      />

      <main className="content">
        <section id="campaign-info" className="campaign-info">
          {activeCampaign && (
            <>
              <h1>{activeCampaign.episode} ({activeCampaign.episode_id})</h1>
              <div className="campaign-meta">
                <span>Hashtag: #{activeCampaign.hashtag}</span>
                <span>Air date: {activeCampaign.date}</span>
                <span>Path: {activeCampaign.icon_path}</span>
              </div>
              <div className="campaign-links">
                {activeCampaign.fringenuity_link && (
                  <a href={activeCampaign.fringenuity_link} target="_blank" rel="noreferrer noopener">Fringenuity</a>
                )}
                {activeCampaign.imdb_link && (
                  <a href={activeCampaign.imdb_link} target="_blank" rel="noreferrer noopener">IMDB</a>
                )}
                {activeCampaign.wiki_link && (
                  <a href={activeCampaign.wiki_link} target="_blank" rel="noreferrer noopener">Wiki</a>
                )}
              </div>
            </>
          )}
        </section>

        <section id="gallery" className={`gallery-grid${activeCampaign && images.length === 0 ? ' empty' : ''}`} aria-live="polite">
          {activeCampaign && images.length === 0 ? (
            <div className="empty-state" role="status" aria-live="polite">
              <div className="empty-emoji" aria-hidden>🖼️</div>
              <div className="empty-title">No Images In Campaign</div>
              <div className="empty-desc">This campaign has no uploaded images yet.</div>
            </div>
          ) : (
            images.map((img, i) => (
              <div className="card" key={`${img.src}-${i}`}>
                {img.isLoading ? (
                  <div className="image-placeholder">
                    <div className="placeholder-content">
                      <div className="placeholder-icon">📷</div>
                      <div className="placeholder-text">Loading...</div>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={img.loadedSrc || img.src || ''} 
                    alt={img.fileName} 
                    loading="lazy" 
                    onClick={(e) => openLightbox(i, e.currentTarget)} 
                  />
                )}
                <div className="filename">{img.fileName}</div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Build info popover */}
      {isBuildInfoOpen && (
        <div className="build-info-popover" role="dialog" aria-modal={false} style={buildStyle}>
          <div className="build-info-header">
            <span>Build Info</span>
            <button
              className="build-info-close"
              aria-label="Close build info"
              onClick={() => setIsBuildInfoOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="build-info-body">
            <div className="row">
              <span className="label">Repo</span>
              {repoHref ? (
                <a href={repoHref} target="_blank" rel="noreferrer noopener">{repoHref}</a>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Commit</span>
              {buildInfo?.commitHash ? (
                <span className="value monospace" title={buildInfo.commitHash}>{buildInfo.commitHash}</span>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Time of build:</span>
              <span className="value">{buildInfo?.builtAt ? formatTimePacific(buildInfo.builtAt) : 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Share popover */}
      {isShareOpen && (
        <div className="share-popover" role="dialog" aria-modal={false} style={shareStyle}>
          <div className="share-header">
            <span>Share</span>
            <button
              className="share-close"
              aria-label="Close share"
              onClick={() => setIsShareOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="share-body">
            <a
              className="action-btn"
              href={threadsShareUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Share on Threads
            </a>
          </div>
        </div>
      )}

      <footer className="navbar" id="bottom-navbar">
        <div className="navbar-inner">
          <button className="nav-arrow" aria-label="Previous campaign" onClick={goToPrevCampaign} disabled={isCampaignLoading}>◀</button>
          <div className="current-campaign" data-testid="current-campaign-bottom" title={activeCampaign ? `#${activeCampaign.hashtag}` : ''}>
            {activeCampaign ? `#${activeCampaign.hashtag}` : ''}
          </div>
          <button className="nav-arrow" aria-label="Next campaign" onClick={goToNextCampaign} disabled={isCampaignLoading}>▶</button>
        </div>
      </footer>

      <LightboxContainer
        images={images}
        lightboxIndex={lightboxIndex}
        isLightboxOpen={isLightboxOpen}
        hideLightboxImage={hideLightboxImage}
        activeCampaign={activeCampaign}
        setLightboxIndex={setLightboxIndex}
        closeLightbox={closeLightbox}
        isAnimatingRef={isAnimatingRef}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="content-modal-overlay" onClick={closeSettings} role="dialog" aria-modal={true} aria-labelledby="settings-title">
          <div className="content-modal" ref={settingsModalRef} onClick={(e) => e.stopPropagation()}>
            <div className="content-modal-header">
              <span className="content-modal-title" id="settings-title">Settings</span>
              <button className="content-modal-close" ref={settingsCloseRef} aria-label="Close settings" onClick={closeSettings}>✕</button>
            </div>
            <div className="content-modal-body settings-body">
              <h3 style={{ marginTop: 0 }}>Accessibility</h3>
              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-label-text" id="settings-reduce-motion-label">Reduce Motion</span>
                  <span className="settings-label-desc">Disable animations and transitions</span>
                </div>
                <button
                  className={`settings-toggle${reduceMotion ? ' active' : ''}`}
                  role="switch"
                  aria-checked={reduceMotion}
                  aria-labelledby="settings-reduce-motion-label"
                  onClick={() => setReduceMotion(v => !v)}
                >
                  <span className="settings-toggle-knob"></span>
                </button>
              </div>
              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-label-text" id="settings-reduce-effects-label">Reduce Effects</span>
                  <span className="settings-label-desc">Minimize glow, scanlines, and visual effects</span>
                </div>
                <button
                  className={`settings-toggle${reduceEffects ? ' active' : ''}`}
                  role="switch"
                  aria-checked={reduceEffects}
                  aria-labelledby="settings-reduce-effects-label"
                  onClick={() => setReduceEffects(v => !v)}
                >
                  <span className="settings-toggle-knob"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ContentModal
        activeModal={activeModal}
        content={modalContent}
        isLoading={isModalLoading}
        onClose={closeModal}
      />
    </div>
  );
}


