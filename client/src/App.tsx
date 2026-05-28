import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useLightboxAnimations } from './hooks/useLightboxAnimations';
import { useCampaignLoader } from './hooks/useCampaignLoader';
import { fetchJSON } from './utils/fetchJSON';
import { closeSubwindowsState } from './utils/closeSubwindowsState';
import { isSafeUrl } from './utils/isSafeUrl';
import { applyTheme } from './config/theme';
import { SITE_URL, SITE_SHARE_TEXT } from './config/site';
import {
  clampThumbnailSizeIndex,
  GALLERY_DEFAULT_SIZE_INDEX,
  GALLERY_THUMBNAIL_SIZES,
  GALLERY_THUMBNAIL_GAPS,
} from './config/gallery';
import LoadingManager from './components/LoadingManager';
import CampaignNavigation from './components/CampaignNavigation';
import NavSwitcher from './components/NavSwitcher';
import BuildInfoPopover from './components/BuildInfoPopover';
import SharePopover from './components/SharePopover';
import ContentModal from './components/ContentModal';
import SettingsModal from './components/SettingsModal';
import LightboxContainer from './components/LightboxContainer';
import GalleryGrid, { type GalleryGridHandle } from './components/GalleryGrid';
import AuthorsIndex from './components/AuthorsIndex';
import AuthorDetail from './components/AuthorDetail';
import { parseHashRoute, type HashRoute } from './utils/parseHashRoute';
import type {
  Campaign,
  BuildInfo,
  CampaignsResponse,
  BuildInfoResponse,
  ContentPage,
  ContentResponse,
  ImageData,
  LightboxImageSource,
  AuthorWithCount,
  AuthorsResponse,
} from './types/api';
import { UNKNOWN_ARTIST_HANDLE, UNKNOWN_ARTIST_NAME } from './types/api';

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const {
    currentImages,
    isCampaignLoading,
    campaignLoadProgress,
    campaignLoadTotal,
    campaignLoadError,
    campaignLoadAbortRef,
    loadCampaignImages,
    selectCampaign: selectCampaignFromHook,
  } = useCampaignLoader();
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  // The image list currently being browsed in the lightbox. Set by whichever
  // view opens the lightbox (campaign gallery vs. author detail) so the
  // lightbox can navigate across an arbitrary list — not just the active
  // campaign's images. Null when the lightbox has never been opened or has
  // been closed; we fall back to `currentImages` in that case so render code
  // does not have to handle a null source separately.
  //
  // Both source kinds are wired up: campaign-mode via openLightboxForCampaign
  // and author-mode via openLightboxForAuthor (fringematrix5-ik5).
  const [lightboxImageSource, setLightboxImageSource] = useState<LightboxImageSource | null>(null);
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
  const galleryGridRef = useRef<GalleryGridHandle>(null);
  // Ref to the AuthorDetail's inner GalleryGrid. App owns it (passed down as
  // a prop) so `getThumbElement` below can route to the correct grid based on
  // the active lightbox source. Null when not on the author-detail route.
  const authorGridRef = useRef<GalleryGridHandle>(null);
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
  const [thumbnailSizeIndex, setThumbnailSizeIndex] = useState<number>(GALLERY_DEFAULT_SIZE_INDEX);
  // Settings modal: trigger ref for focus restoration on close
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const modalLoadAbortRef = useRef<AbortController | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

  // Artists list cached at App-level so the artist switcher in the top/bottom
  // navbars (used when route.type === 'author-detail') can render prev/next
  // arrows + the current artist name without each navigation re-fetching the
  // full list. Lazily fetched the first time we land on an author-detail
  // route, then reused for the rest of the session. Reuses the existing
  // `/api/authors` endpoint that powers AuthorsIndex — no new server work
  // required for this bead.
  const [artists, setArtists] = useState<AuthorWithCount[] | null>(null);

  // Route state: which top-level view to render. Driven by the URL hash so it
  // survives reloads and is bookmarkable. The hash also drives campaign
  // selection (see the mount effect below); on first render we seed `route`
  // synchronously from window.location.hash so the correct view paints on
  // initial render and SSR-friendly fallback ('gallery') for the no-window case.
  const [route, setRoute] = useState<HashRoute>(() => {
    if (typeof window === 'undefined') return { type: 'gallery', campaignId: null };
    return parseHashRoute(window.location.hash);
  });

  // Apply theme CSS variables on mount
  useEffect(() => {
    applyTheme();
  }, []);

  // Keep `route` in sync with the URL hash. This handles direct navigation
  // (#authors / #authors/:handle) via browser back/forward as well as our
  // own programmatic navigation that calls window.location.hash = '...'.
  useEffect(() => {
    function handleHashChange() {
      setRoute(parseHashRoute(window.location.hash));
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Programmatic navigation helpers for the Authors pages. Setting the hash
  // triggers the listener above, which updates `route`. We don't push
  // intermediate state — the URL is the source of truth.
  const navigateToAuthorsIndex = useCallback(() => {
    window.location.hash = 'authors';
  }, []);
  const navigateToAuthorDetail = useCallback((handle: string) => {
    window.location.hash = `authors/${encodeURIComponent(handle)}`;
  }, []);
  const navigateToGalleryHome = useCallback(() => {
    // Drop the hash entirely so the gallery view falls back to its default
    // campaign on next mount; for the current session we just clear route.
    window.history.replaceState({}, '', window.location.pathname);
    setRoute({ type: 'gallery', campaignId: activeCampaignId });
  }, [activeCampaignId]);

  // Load accessibility settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('fringematrix-a11y');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.reduceMotion === 'boolean') setReduceMotion(parsed.reduceMotion);
        if (typeof parsed.reduceEffects === 'boolean') setReduceEffects(parsed.reduceEffects);
        // Clamp the saved index to the current sizes array in case the
        // config changed between sessions (e.g. sizes array shrank).
        if (
          typeof parsed.thumbnailSizeIndex === 'number'
          && Number.isFinite(parsed.thumbnailSizeIndex)
          && Number.isInteger(parsed.thumbnailSizeIndex)
        ) {
          setThumbnailSizeIndex(clampThumbnailSizeIndex(parsed.thumbnailSizeIndex));
        }
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
      localStorage.setItem(
        'fringematrix-a11y',
        JSON.stringify({ reduceMotion, reduceEffects, thumbnailSizeIndex }),
      );
    } catch { /* ignore storage errors */ }
  }, [reduceMotion, reduceEffects, thumbnailSizeIndex]);

  // Apply the resolved thumbnail size and gap to CSS variables so
  // styles.css `.gallery-grid` picks up both values at the current scale step.
  // GALLERY_THUMBNAIL_SIZES are in device pixels; divide by devicePixelRatio
  // to get CSS pixels for the grid track minimum.
  // GALLERY_THUMBNAIL_GAPS are already in CSS px and applied directly.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const devicePx = GALLERY_THUMBNAIL_SIZES[thumbnailSizeIndex];
    if (typeof devicePx !== 'number' || !Number.isFinite(devicePx)) return;
    const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    const cssSize = devicePx / dpr;
    document.documentElement.style.setProperty('--thumbnail-min-size', `${cssSize}px`);
    const gapPx = GALLERY_THUMBNAIL_GAPS[thumbnailSizeIndex];
    if (typeof gapPx === 'number' && Number.isFinite(gapPx)) {
      document.documentElement.style.setProperty('--grid-gap', `${gapPx}px`);
    }
  }, [thumbnailSizeIndex]);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) || null,
    [campaigns, activeCampaignId]
  );

  const selectCampaign = useCallback(async (id: string) => {
    await selectCampaignFromHook(id, (campaignId) => {
      setActiveCampaignId(campaignId);
      // `replaceState` does NOT fire a hashchange event, so we have to manually
      // sync `route` here — otherwise the route-sync effect below would see a
      // mismatch between route.campaignId and activeCampaignId and snap us
      // back to the previous campaign. (Spotted in code review of bead lfn.)
      window.history.replaceState({}, '', `#${campaignId}`);
      setRoute({ type: 'gallery', campaignId });
    });
  }, [selectCampaignFromHook]);

  // Stable ref to `selectCampaign` so the route-sync effect below doesn't
  // need to re-subscribe every time selectCampaign's identity changes.
  const selectCampaignRef = useRef(selectCampaign);
  useEffect(() => {
    selectCampaignRef.current = selectCampaign;
  }, [selectCampaign]);

  // When the route flips to gallery with a different campaignId (e.g. an
  // author-detail thumbnail click sets the hash to a campaign id), select
  // that campaign so the gallery view shows the right images.
  useEffect(() => {
    if (route.type !== 'gallery') return;
    if (!route.campaignId) return;
    if (route.campaignId === activeCampaignId) return;
    if (campaigns.length === 0) return;
    const exists = campaigns.some((c) => c.id === route.campaignId);
    if (!exists) return;
    selectCampaignRef.current?.(route.campaignId);
  }, [route, campaigns, activeCampaignId]);

  // Lazily fetch the artists list the first time we land on the author-detail
  // route. Only the artist nav-switcher (in the top/bottom navbars) needs
  // this list at the App level — AuthorsIndex keeps its own fetch with its
  // own loading/error state. Scoped to `author-detail` so visiting the
  // authors-index page does NOT trigger a duplicate /api/authors request
  // alongside the one AuthorsIndex already makes. We only fetch once per
  // session; refetching would require invalidation logic that isn't worth
  // the complexity here.
  useEffect(() => {
    if (route.type !== 'author-detail') return;
    if (artists !== null) return;
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJSON<AuthorsResponse>('/api/authors', { signal: controller.signal });
        if (cancelled) return;
        setArtists(data.authors ?? []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load artists for nav switcher:', e);
        // Set to empty array so we stop retrying. The nav switcher will fall
        // back to showing just the handle from the route — better than
        // looping fetches.
        setArtists([]);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [route.type, artists]);

  // Resolve the currently active artist (when on the author-detail route)
  // from the cached artists list. Returns null if the list hasn't loaded yet
  // or if the handle isn't in the list — callers fall back to the raw handle
  // from the route.
  const activeArtist = useMemo<AuthorWithCount | null>(() => {
    if (route.type !== 'author-detail') return null;
    if (!artists) return null;
    return artists.find((a) => a.handle === route.handle) ?? null;
  }, [route, artists]);

  // Title shown in the top/bottom navbars when on the author-detail route.
  // Prefers the resolved display name from the artists list; falls back to
  // the URL handle so the bar is never empty while the list is still loading
  // or if the handle isn't found. The sentinel handle (__unknown__) is never
  // in the /api/authors list (it returns a separate unknownCount field), so
  // we special-case it here to avoid showing the raw handle to users.
  const artistNavTitle = useMemo<string>(() => {
    if (route.type !== 'author-detail') return '';
    if (route.handle === UNKNOWN_ARTIST_HANDLE) return UNKNOWN_ARTIST_NAME;
    if (activeArtist) return activeArtist.name || activeArtist.handle;
    return route.handle;
  }, [route, activeArtist]);

  const activeArtistIndex = useMemo<number>(() => {
    if (route.type !== 'author-detail') return -1;
    if (!artists) return -1;
    return artists.findIndex((a) => a.handle === route.handle);
  }, [route, artists]);

  const goToNextArtist = useCallback(() => {
    if (!artists || artists.length === 0) return;
    const nextIdx = activeArtistIndex < 0 ? 0 : (activeArtistIndex + 1) % artists.length;
    const next = artists[nextIdx];
    if (next) navigateToAuthorDetail(next.handle);
  }, [artists, activeArtistIndex, navigateToAuthorDetail]);

  const goToPrevArtist = useCallback(() => {
    if (!artists || artists.length === 0) return;
    const prevIdx = activeArtistIndex < 0
      ? artists.length - 1
      : (activeArtistIndex - 1 + artists.length) % artists.length;
    const prev = artists[prevIdx];
    if (prev) navigateToAuthorDetail(prev.handle);
  }, [artists, activeArtistIndex, navigateToAuthorDetail]);

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

  // Sync open state into ref so onScrollOrResize can read it without becoming a new function reference that re-triggers addEventListener.
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
    return `https://www.threads.net/intent/post?text=${encodeURIComponent(SITE_SHARE_TEXT)}&url=${encodeURIComponent(SITE_URL)}`;
  }, []);

  const blueskyShareUrl = useMemo(() => {
    const text = `${SITE_SHARE_TEXT} ${SITE_URL}`;
    return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
  }, []);

  const redditShareUrl = useMemo(() => {
    const params = new URLSearchParams({
      title: SITE_SHARE_TEXT,
      url: SITE_URL,
    });
    return `https://www.reddit.com/submit?${params.toString()}`;
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
        const campaignList = data.campaigns || [];
        setCampaigns(campaignList);

        // Update loading screen with campaign count
        setLoadingCampaignCount(campaignList.length);

        // Choose initial campaign and load its images.
        // Note: when the URL hash points to a non-gallery route (e.g. #authors
        // or #authors/:handle) the campaign id lookup will miss and we fall
        // back to the first campaign for preload. The hash is NOT rewritten in
        // that case — otherwise we'd clobber the user's authors route on load.
        const parsedHash = parseHashRoute(window.location.hash);
        const hashCampaignId = parsedHash.type === 'gallery' ? parsedHash.campaignId : null;
        const initial = (hashCampaignId
          ? campaignList.find((c: Campaign) => c.id === hashCampaignId)
          : null) || campaignList[0];

        if (initial) {
          // Mount-time initial campaign load. Shares campaignLoadAbortRef so a
          // user clicking a different campaign before this finishes aborts cleanly.
          const controller = new AbortController();
          campaignLoadAbortRef.current = controller;

          setActiveCampaignId(initial.id);
          // Only sync the hash when we're on a gallery route — never overwrite
          // an explicit non-gallery hash (#authors, #authors/:handle).
          if (parsedHash.type === 'gallery') {
            window.history.replaceState({}, '', `#${initial.id}`);
          }

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

  // Mirror lightboxImageSource into a ref so getThumbElement can read the
  // current kind without itself becoming a new function reference on every
  // source change (which would cascade into useLightboxAnimations re-creating
  // its own callbacks). Updated synchronously during render so the ref is
  // always consistent with the rendered state — `getThumbElement` cannot
  // observe a stale value between a state change and an effect flush.
  const lightboxImageSourceRef = useRef(lightboxImageSource);
  lightboxImageSourceRef.current = lightboxImageSource;

  // Stable callback so the hook never re-creates its callbacks due to a new
  // function reference. The grid refs and source-kind are read at call time
  // via refs, so the useCallback dep array is intentionally empty.
  //
  // Routes by the active lightbox source: author-browse mode reads from the
  // AuthorDetail grid; everything else (campaign-mode + fallback) reads from
  // the campaign GalleryGrid. fringematrix5-jq33.
  const getThumbElement = useCallback((index: number): HTMLImageElement | null => {
    if (lightboxImageSourceRef.current?.kind === 'author') {
      return authorGridRef.current?.getThumbElement(index) ?? null;
    }
    return galleryGridRef.current?.getThumbElement(index) ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Images the lightbox is currently navigating. When a source is set we use
  // it; otherwise we fall back to the active campaign's images so existing
  // callers (gallery thumbnail clicks) keep working without explicitly
  // setting a source first.
  const lightboxImages = lightboxImageSource?.images ?? currentImages;

  // Lightbox animations are provided by the useLightboxAnimations hook
  const { openLightbox, closeLightbox, isAnimatingRef } = useLightboxAnimations({
    images: lightboxImages,
    isLightboxOpen,
    lightboxIndex,
    reduceMotion,
    setLightboxIndex,
    setIsLightboxOpen,
    setHideLightboxImage,
    getThumbElement,
  });

  // Opens the lightbox against the currently active campaign's images. This
  // is the gallery-grid path; author-detail uses its own opener (added in
  // fringematrix5-ik5). Sets the campaign-mode source before delegating to
  // the animation hook's openLightbox so the lightbox renders against the
  // same array we just stamped into state.
  const openLightboxForCampaign = useCallback((index: number, thumbEl?: HTMLElement) => {
    if (activeCampaignId) {
      setLightboxImageSource({ kind: 'campaign', images: currentImages, campaignId: activeCampaignId });
    }
    openLightbox(index, thumbEl);
  }, [activeCampaignId, currentImages, openLightbox]);

  // Opens the lightbox against an author's image list (author-browse mode,
  // fringematrix5-ik5). The images may span multiple campaigns; each carries
  // its own `campaignId` and a synthesized `author` block so LightboxDetails
  // resolves the source campaign and AUTHOR row per-image as the user pages.
  //
  // `thumbEl` is the clicked thumbnail `<img>` (forwarded from AuthorDetail's
  // GalleryGrid). It seeds the zoom-in animation's source rect and lets the
  // active-thumb-hide path know which cell to blank out — matching campaign
  // gallery parity (fringematrix5-jq33). The hook's getThumbElement (above)
  // routes back to authorGridRef for next/prev navigation while the lightbox
  // is open.
  const openLightboxForAuthor = useCallback((images: ImageData[], index: number, handle: string, thumbEl?: HTMLElement) => {
    setLightboxImageSource({ kind: 'author', images, handle });
    openLightbox(index, thumbEl);
  }, [openLightbox]);

  // Clear the lightbox source once the lightbox has fully closed so we never
  // hand stale (e.g. a previous campaign's) images to the next open. Safe to
  // run here: closeLightbox only flips `isLightboxOpen` to false from its
  // finally block, after all close animations have settled, so nothing is
  // still reading `lightboxImages` when this fires.
  useEffect(() => {
    if (!isLightboxOpen && lightboxImageSource) {
      setLightboxImageSource(null);
    }
  }, [isLightboxOpen, lightboxImageSource]);

  // Handler for clicking the author handle inside the lightbox details panel
  // (fringematrix5-4a6o). We close the lightbox first so its exit animation
  // runs, then push the author-detail hash. closeLightbox is idempotent and
  // hashchange-driven routing keeps the URL as the source of truth.
  const handleOpenAuthorGalleryFromLightbox = useCallback((handle: string) => {
    closeLightbox();
    navigateToAuthorDetail(handle);
  }, [closeLightbox, navigateToAuthorDetail]);

  // Stable handler for the EPISODE NAME / HASHTAG affordance in
  // `LightboxDetails`. Hoisted into useCallback so `LightboxDetails` — which is
  // React.memo'd — doesn't re-render on every App render just because a fresh
  // inline arrow would change prop identity. (Spotted in Copilot review of
  // fringematrix5-c320.)
  //
  // Routing semantics (fringematrix5-u7gd):
  // Always force the route back to {type: 'gallery', campaignId} regardless of
  // whether activeCampaignId already matches. The lightbox can be opened from
  // artist-browse mode (route = author-detail) on an image whose source
  // campaign equals the previously-active campaign id; in that case
  // selectCampaign would early-return because the campaign isn't changing, and
  // the route would stay stranded on the artist page. Updating the hash
  // unconditionally guarantees the user lands on the campaign gallery view.
  // selectCampaign is only invoked when the campaign actually needs to change.
  const handleOpenCampaignGallery = useCallback((campaignId: string) => {
    closeLightbox();
    if (campaignId !== activeCampaignId) {
      // selectCampaign handles both the data fetch and the route update
      // (it sets the hash and route via its inner callback).
      selectCampaign(campaignId);
    } else {
      // Same campaign as the currently-active one; selectCampaign would be a
      // no-op so we update the hash + route ourselves to leave artist-browse
      // mode (or any other non-gallery route) and return to the gallery view.
      window.history.replaceState({}, '', `#${campaignId}`);
      setRoute({ type: 'gallery', campaignId });
    }
  }, [closeLightbox, activeCampaignId, selectCampaign]);

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
    // Ensure we're on the gallery view (in case user was on an Authors page)
    setRoute({ type: 'gallery', campaignId: firstCampaign?.id ?? null });
    // Select the first campaign
    if (firstCampaign) selectCampaign(firstCampaign.id);
  }, [campaigns, selectCampaign, closeAllSubwindows]);

  // Settings modal: close callback with focus restoration
  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
    settingsTriggerRef.current?.focus();
    settingsTriggerRef.current = null;
  }, []);

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
            onClick={navigateToAuthorsIndex}
            disabled={isCampaignLoading}
          >
            Artists
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
          {route.type === 'author-detail' ? (
            <NavSwitcher
              label={artistNavTitle}
              title={artistNavTitle}
              testId="current-artist-top"
              prevLabel="Previous artist"
              nextLabel="Next artist"
              onPrev={goToPrevArtist}
              onNext={goToNextArtist}
              disabled={!artists || artists.length <= 1}
            />
          ) : (
            <NavSwitcher
              label={activeCampaign ? `#${activeCampaign.hashtag}` : ''}
              title={activeCampaign ? `#${activeCampaign.hashtag}` : ''}
              testId="current-campaign-top"
              prevLabel="Previous campaign"
              nextLabel="Next campaign"
              onPrev={goToPrevCampaign}
              onNext={goToNextCampaign}
              disabled={isCampaignLoading}
              hidden={route.type === 'authors-index'}
            />
          )}
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

      {route.type === 'authors-index' && (
        <AuthorsIndex
          onSelectAuthor={navigateToAuthorDetail}
          onBack={navigateToGalleryHome}
        />
      )}

      {route.type === 'author-detail' && (
        <AuthorDetail
          handle={route.handle}
          onBack={navigateToAuthorsIndex}
          onOpenImage={openLightboxForAuthor}
          gridRef={authorGridRef}
        />
      )}

      {route.type === 'gallery' && (
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
                  {isSafeUrl(activeCampaign.fringenuity_link) && (
                    <a href={activeCampaign.fringenuity_link} target="_blank" rel="noreferrer noopener">Fringenuity</a>
                  )}
                  {isSafeUrl(activeCampaign.imdb_link) && (
                    <a href={activeCampaign.imdb_link} target="_blank" rel="noreferrer noopener">IMDB</a>
                  )}
                  {isSafeUrl(activeCampaign.wiki_link) && (
                    <a href={activeCampaign.wiki_link} target="_blank" rel="noreferrer noopener">Wiki</a>
                  )}
                </div>
              </>
            )}
          </section>

          {activeCampaign && currentImages.length === 0 ? (
            // Caller-owned empty state, previously rendered inside GalleryGrid
            // behind a `hasCampaign` prop. Hoisted up here in fringematrix5-jq33
            // so GalleryGrid stays a pure list view reusable by AuthorDetail.
            <section
              id="gallery"
              className="gallery-grid empty"
              aria-live="polite"
            >
              <div className="empty-state" role="status" aria-live="polite">
                <div className="empty-emoji" aria-hidden>🖼️</div>
                <div className="empty-title">No Images In Campaign</div>
                <div className="empty-desc">This campaign has no uploaded images yet.</div>
              </div>
            </section>
          ) : (
            <GalleryGrid
              ref={galleryGridRef}
              images={currentImages}
              onImageClick={openLightboxForCampaign}
            />
          )}
        </main>
      )}

      {/* Build info popover */}
      {isBuildInfoOpen && (
        <BuildInfoPopover
          style={buildStyle}
          buildInfo={buildInfo}
          onClose={() => setIsBuildInfoOpen(false)}
        />
      )}

      {/* Share popover */}
      {isShareOpen && (
        <SharePopover
          style={shareStyle}
          threadsShareUrl={threadsShareUrl}
          blueskyShareUrl={blueskyShareUrl}
          redditShareUrl={redditShareUrl}
          onClose={() => setIsShareOpen(false)}
        />
      )}

      <footer className="navbar" id="bottom-navbar">
        <div className="navbar-inner">
          {route.type === 'author-detail' ? (
            <NavSwitcher
              label={artistNavTitle}
              title={artistNavTitle}
              testId="current-artist-bottom"
              prevLabel="Previous artist"
              nextLabel="Next artist"
              onPrev={goToPrevArtist}
              onNext={goToNextArtist}
              disabled={!artists || artists.length <= 1}
            />
          ) : (
            <NavSwitcher
              label={activeCampaign ? `#${activeCampaign.hashtag}` : ''}
              title={activeCampaign ? `#${activeCampaign.hashtag}` : ''}
              testId="current-campaign-bottom"
              prevLabel="Previous campaign"
              nextLabel="Next campaign"
              onPrev={goToPrevCampaign}
              onNext={goToNextCampaign}
              disabled={isCampaignLoading}
              hidden={route.type === 'authors-index'}
            />
          )}
        </div>
      </footer>

      <LightboxContainer
        images={lightboxImages}
        lightboxIndex={lightboxIndex}
        isLightboxOpen={isLightboxOpen}
        hideLightboxImage={hideLightboxImage}
        activeCampaign={activeCampaign}
        campaigns={campaigns}
        setLightboxIndex={setLightboxIndex}
        closeLightbox={closeLightbox}
        isAnimatingRef={isAnimatingRef}
        onOpenAuthorGallery={handleOpenAuthorGalleryFromLightbox}
        onOpenCampaignGallery={handleOpenCampaignGallery}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        isReduceMotion={reduceMotion}
        isReduceEffects={reduceEffects}
        onToggleReduceMotion={() => setReduceMotion(v => !v)}
        onToggleReduceEffects={() => setReduceEffects(v => !v)}
        thumbnailSizeIndex={thumbnailSizeIndex}
        onChangeThumbnailSizeIndex={setThumbnailSizeIndex}
      />

      <ContentModal
        activeModal={activeModal}
        content={modalContent}
        isLoading={isModalLoading}
        onClose={closeModal}
      />
    </div>
  );
}
