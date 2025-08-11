import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { fetchJSON } from './utils/fetchJSON.js';
import { formatDeployedAtPacific } from './utils/formatDeployedAtPacific.js';
import { gitRemoteToHttps } from './utils/gitRemoteToHttps.js';

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [images, setImages] = useState([]);
  const [imagesByCampaign, setImagesByCampaign] = useState({});
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);
  const [isPreloading, setIsPreloading] = useState(true);
  const [loadingDots, setLoadingDots] = useState(0);
  const [preloadLoaded, setPreloadLoaded] = useState(0);
  const [preloadTotal, setPreloadTotal] = useState(0);

  const repoHref = useMemo(
    () => gitRemoteToHttps(buildInfo?.repoUrl || ''),
    [buildInfo?.repoUrl]
  );

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) || null,
    [campaigns, activeCampaignId]
  );

  const selectCampaign = useCallback(async (id) => {
    setActiveCampaignId(id);
    window.history.replaceState({}, '', `#${id}`);
    const cached = imagesByCampaign[id];
    if (cached) {
      setImages(cached);
      return;
    }
    // Fallback (should not happen if preloading completed)
    const data = await fetchJSON(`/api/campaigns/${id}/images`);
    const list = data.images || [];
    setImagesByCampaign((prev) => ({ ...prev, [id]: list }));
    setImages(list);
  }, [imagesByCampaign]);

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
    setIsBuildInfoOpen((v) => !v);
    setIsShareOpen(false);
    if (!buildInfo) {
      try {
        const data = await fetchJSON('/api/build-info');
        setBuildInfo(data);
      } catch (e) {
        console.error(e);
        setBuildInfo({ repoUrl: null, commitHash: null, deployedAt: null });
      }
    }
  }, [buildInfo]);

  const toggleShare = useCallback(() => {
    setIsShareOpen((v) => !v);
    setIsBuildInfoOpen(false);
  }, []);

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

        // Fetch image lists for all campaigns
        const lists = await Promise.all(
          (data.campaigns || []).map(async (c) => {
            try {
              const res = await fetchJSON(`/api/campaigns/${c.id}/images`);
              return { id: c.id, images: res.images || [] };
            } catch (e) {
              console.error('Failed to fetch images for campaign', c.id, e);
              return { id: c.id, images: [] };
            }
          })
        );
        if (!isMounted) return;
        const map = Object.fromEntries(lists.map((x) => [x.id, x.images]));
        setImagesByCampaign(map);

        // Compute all image URLs and preload them before showing the app
        const allUrls = lists.flatMap((x) => x.images.map((img) => img.src));
        setPreloadTotal(allUrls.length);

        await Promise.all(
          allUrls.map(
            (src) =>
              new Promise((resolve) => {
                const img = new Image();
                const done = () => {
                  if (isMounted) setPreloadLoaded((n) => n + 1);
                  resolve();
                };
                img.onload = done;
                img.onerror = done;
                img.src = src;
              })
          )
        );
        if (!isMounted) return;

        // Choose initial campaign and show app
        const hash = window.location.hash.replace('#', '');
        const initial = (data.campaigns || []).find((c) => c.id === hash) || (data.campaigns || [])[0];
         if (initial) {
          setActiveCampaignId(initial.id);
          window.history.replaceState({}, '', `#${initial.id}`);
          setImages(map[initial.id] || []);
        }
         if (isMounted) setIsPreloading(false);
      } catch (e) {
        console.error(e);
        alert('Failed to initialize app. Check console for details.');
         if (isMounted) setIsPreloading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Animated dots for the CRT loader
  useEffect(() => {
    if (!isPreloading) return;
    const id = setInterval(() => setLoadingDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, [isPreloading]);

  const openLightbox = useCallback((index) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsLightboxOpen(false);
  }, []);

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

  return (
    <div id="app">
      {isPreloading && (
        <div className="crt-overlay" role="dialog" aria-modal={true} aria-label="Loading">
          <div className="crt-inner">
            <div className="crt-text">
              Fringe Matrix 5 Loading<span className="dots">{'.'.repeat(loadingDots)}</span>
              <div className="crt-subtext">{preloadTotal ? `${preloadLoaded} / ${preloadTotal}` : ''}</div>
            </div>
          </div>
        </div>
      )}
      <header className="navbar" id="top-navbar">
        <div className="navbar-inner">
          <button className="nav-arrow" aria-label="Previous campaign" onClick={goToPrevCampaign}>◀</button>
          <div className="current-campaign" title={activeCampaign ? `#${activeCampaign.hashtag}` : ''}>
            {activeCampaign ? `#${activeCampaign.hashtag}` : ''}
          </div>
          <button className="nav-arrow" aria-label="Next campaign" onClick={goToNextCampaign}>▶</button>
        </div>
      </header>

      <button
        className={`sidebar-toggle${isSidebarOpen ? ' open' : ''}`}
        aria-label={isSidebarOpen ? 'Close campaign list' : 'Open campaign list'}
        onClick={toggleSidebar}
      >
        {isSidebarOpen ? '✕' : '☰'}
      </button>

      <aside className={`sidebar${isSidebarOpen ? ' open' : ''}`} aria-hidden={!isSidebarOpen}>
        <div className="sidebar-header">All Campaigns</div>
        <div className="sidebar-list">
          {campaigns.map((c) => (
            <button
              key={c.id}
              className={`sidebar-item${c.id === activeCampaignId ? ' active' : ''}`}
              onClick={async () => { await selectCampaign(c.id); closeSidebar(); }}
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
                <img src={img.src} alt={img.fileName} loading="lazy" onClick={() => openLightbox(i)} />
                <div className="filename">{img.fileName}</div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Build info button */}
      <button
        className="build-info-button"
        aria-label="Build information"
        onClick={toggleBuildInfo}
      >
        ⓘ
      </button>

      {/* Share button */}
      <button
        className="share-button"
        aria-label="Share"
        onClick={toggleShare}
      >
        Share
      </button>

      {/* Build info popover */}
      {isBuildInfoOpen && (
        <div className="build-info-popover" role="dialog" aria-modal={false}>
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
              <span className="label">Deployed</span>
              <span className="value">{buildInfo?.deployedAt ? formatDeployedAtPacific(buildInfo.deployedAt) : 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Share popover */}
      {isShareOpen && (
        <div className="share-popover" role="dialog" aria-modal={false}>
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
          <button className="nav-arrow" aria-label="Previous campaign" onClick={goToPrevCampaign}>◀</button>
          <div className="current-campaign" title={activeCampaign ? `#${activeCampaign.hashtag}` : ''}>
            {activeCampaign ? `#${activeCampaign.hashtag}` : ''}
          </div>
          <button className="nav-arrow" aria-label="Next campaign" onClick={goToNextCampaign}>▶</button>
        </div>
      </footer>

      {isLightboxOpen && (
        <div id="lightbox" className="lightbox" aria-hidden={false}>
          <button className="lightbox-close" id="lightbox-close" aria-label="Close" onClick={closeLightbox}>✕</button>
          <img id="lightbox-image" alt="Selected" src={images[lightboxIndex]?.src} />
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


