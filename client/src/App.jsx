import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLightboxAnimations } from './hooks/useLightboxAnimations.js';
import { fetchJSON } from './utils/fetchJSON.js';
import { formatTimePacific } from './utils/formatTimePacific.js';
import { gitRemoteToHttps } from './utils/gitRemoteToHttps.js';

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [images, setImages] = useState([]);
  const [imagesByCampaign, setImagesByCampaign] = useState({});
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [hideLightboxImage, setHideLightboxImage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);
  const [isPreloading, setIsPreloading] = useState(true);
  const [loadingDots, setLoadingDots] = useState(0);
  const [preloadLoaded, setPreloadLoaded] = useState(0);
  const [preloadTotal, setPreloadTotal] = useState(0);
  const [loadingError, setLoadingError] = useState(false);
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const [campaignLoadProgress, setCampaignLoadProgress] = useState(0);
  const [campaignLoadTotal, setCampaignLoadTotal] = useState(0);
  const [campaignLoadError, setCampaignLoadError] = useState(false);
  const shareBtnRef = useRef(null);
  const buildBtnRef = useRef(null);
  const [shareStyle, setShareStyle] = useState({});
  const [buildStyle, setBuildStyle] = useState({});

  const repoHref = useMemo(
    () => gitRemoteToHttps(buildInfo?.repoUrl || ''),
    [buildInfo?.repoUrl]
  );

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) || null,
    [campaigns, activeCampaignId]
  );

  const selectCampaign = useCallback(async (id) => {
    if (isCampaignLoading) return;
    
    setActiveCampaignId(id);
    window.history.replaceState({}, '', `#${id}`);
    
    // If images are already loaded, just set them
    if (imagesByCampaign[id]) {
      setImages(imagesByCampaign[id]);
      return;
    }
    
    // Start loading process but don't block UI
    setIsCampaignLoading(true);
    setCampaignLoadProgress(0);
    setCampaignLoadTotal(0);
    setCampaignLoadError(false);
    
    try {
      // Fetch image list for this campaign
      const res = await fetchJSON(`/api/campaigns/${id}/images`);
      const campaignImages = res.images || [];
      
      setCampaignLoadTotal(campaignImages.length);
      
      if (campaignImages.length === 0) {
        setImages([]);
        setIsCampaignLoading(false);
        return;
      }
      
      // Create placeholder images immediately (gray squares)
      const placeholderImages = campaignImages.map(img => ({
        fileName: img.fileName,
        originalSrc: img.src, // Store original URL separately
        src: null, // Don't provide src until loaded
        isLoading: true,
        loadedSrc: null
      }));
      setImages(placeholderImages);
      
      // Load images progressively in background
      let loadedCount = 0;
      let hasError = false;
      
      // Load images one by one and update them as they complete
      const loadPromises = campaignImages.map((img, index) => 
        new Promise((resolve) => {
          const image = new Image();
          const done = () => {
            loadedCount++;
            setCampaignLoadProgress(loadedCount);
            
            // Update this specific image in the array
            setImages(prevImages => 
              prevImages.map((prevImg, i) => 
                i === index 
                  ? { ...prevImg, isLoading: false, src: img.src, loadedSrc: img.src }
                  : prevImg
              )
            );
            resolve();
          };
          image.onload = done;
          image.onerror = () => {
            hasError = true;
            done();
          };
          image.src = img.src;
        })
      );
      
      await Promise.all(loadPromises);
      
      if (hasError) {
        setCampaignLoadError(true);
      }
      
      // Update cache with fully loaded images
      setImagesByCampaign(prev => ({ ...prev, [id]: campaignImages }));
    } catch (error) {
      console.error('Failed to load campaign images:', error);
      setCampaignLoadError(true);
      setImages([]);
    } finally {
      setIsCampaignLoading(false);
    }
  }, [imagesByCampaign, isCampaignLoading]);

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
        const data = await fetchJSON('/api/build-info');
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

  // Stable, throttled scroll/resize handler setup
  const scheduledFrameRef = useRef(null);
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

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsPreloading(true);
        setPreloadLoaded(0);
        setPreloadTotal(0);

        const data = await fetchJSON('/api/campaigns');
        if (!isMounted) return;
        setCampaigns(data.campaigns || []);

        // Choose initial campaign and load its images
        const hash = window.location.hash.replace('#', '');
        const initial = (data.campaigns || []).find((c) => c.id === hash) || (data.campaigns || [])[0];
        
        if (initial) {
          // Use selectCampaign to handle the initial campaign loading
          await selectCampaign(initial.id);
        }
        
        // Only hide the main loader after everything is ready
        if (isMounted) setIsPreloading(false);
      } catch (e) {
        console.error(e);
        setLoadingError(true);
        alert('Failed to initialize app. Check console for details.');
        if (isMounted) setIsPreloading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [selectCampaign]);

  // Animated dots for the CRT loader
  useEffect(() => {
    if (!isPreloading) return;
    const id = setInterval(() => setLoadingDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, [isPreloading]);

  // Lightbox animations are provided by the useLightboxAnimations hook
  const { openLightbox, closeLightbox } = useLightboxAnimations({
    images,
    isLightboxOpen,
    lightboxIndex,
    setLightboxIndex,
    setIsLightboxOpen,
    setHideLightboxImage,
  });

  const nextImage = useCallback((delta) => {
    setLightboxIndex((idx) => (images.length === 0 ? 0 : (idx + delta + images.length) % images.length));
  }, [images.length]);

  const handleShare = useCallback(async () => {
    const img = images[lightboxIndex];
    if (!img) return;
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('img', img.src);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fringe Matrix', text: img.fileName, url: shareUrl.toString() });
      } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl.toString());
      alert('Link copied to clipboard');
    }
  }, [images, lightboxIndex]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') nextImage(1);
      else if (e.key === 'ArrowLeft') nextImage(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isLightboxOpen, closeLightbox, nextImage]);

  // The hook manages the wireframe/backdrop animation timing on open/close

  // Grid thumbnail sync handled by hook

  // Grid thumbnail restore handled by hook

  return (
    <div id="app">
      {isPreloading && !loadingError && (
        <div className="crt-overlay" role="dialog" aria-modal={true} aria-label="Loading">
          <div className="crt-inner">
            <div className="crt-text">
              Fringe Matrix 5 Loading<span className="dots">{'.'.repeat(loadingDots)}</span>
              <div className="crt-subtext">{preloadTotal ? `${preloadLoaded} / ${preloadTotal}` : ''}</div>
            </div>
          </div>
        </div>
      )}
      {isPreloading && loadingError && (
        <div className="crt-overlay" role="alertdialog" aria-modal={true} aria-label="Loading failed">
          <div className="crt-inner">
            <div className="crt-text">
              Fringe Matrix loading failed, check your Internet connection or try reloading the site
            </div>
          </div>
        </div>
      )}
      {/* Top toolbar with primary actions */}
      <div className="toolbar" role="toolbar" aria-label="Primary actions">
        <div className="toolbar-inner">
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

      <aside id="campaign-sidebar" className={`sidebar${isSidebarOpen ? ' open' : ''}`} aria-hidden={!isSidebarOpen}>
        <div className="sidebar-header">All Campaigns</div>
        <div className="sidebar-list">
          {campaigns.map((c) => (
            <button
              key={c.id}
              className={`sidebar-item${c.id === activeCampaignId ? ' active' : ''}`}
              onClick={async () => { await selectCampaign(c.id); closeSidebar(); }}
              disabled={isCampaignLoading}
            >
              #{c.hashtag}
            </button>
          ))}
        </div>
      </aside>
      {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden={true}></div>}

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
                    src={img.loadedSrc || img.src} 
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

      {isLightboxOpen && (
        <div id="lightbox" className="lightbox" aria-hidden={false}>
          <button className="lightbox-close" id="lightbox-close" aria-label="Close" onClick={closeLightbox}>✕</button>
          <img
            id="lightbox-image"
            alt="Selected"
            src={images[lightboxIndex]?.src}
            style={{ opacity: hideLightboxImage ? 0 : 1, transition: 'opacity .12s ease' }}
          />
          <div className="lightbox-actions">
            <button id="prev-btn" className="nav-btn" aria-label="Previous" onClick={() => nextImage(-1)}>◀</button>
            <div className="spacer"></div>
            <a id="download-btn" className="action-btn" download href={images[lightboxIndex]?.src || '#'}>Download</a>
            <button id="share-btn" className="action-btn" onClick={handleShare}>Share</button>
            <div className="spacer"></div>
            <button id="next-btn" className="nav-btn" aria-label="Next" onClick={() => nextImage(1)}>▶</button>
          </div>
        </div>
      )}
    </div>
  );
}


