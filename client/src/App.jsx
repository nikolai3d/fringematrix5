import React, { useEffect, useMemo, useState, useCallback } from 'react';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [images, setImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) || null,
    [campaigns, activeCampaignId]
  );

  const selectCampaign = useCallback(async (id) => {
    setActiveCampaignId(id);
    window.history.replaceState({}, '', `#${id}`);
    const data = await fetchJSON(`/api/campaigns/${id}/images`);
    setImages(data.images || []);
  }, []);

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

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchJSON('/api/campaigns');
        if (!isMounted) return;
        setCampaigns(data.campaigns || []);
        const hash = window.location.hash.replace('#', '');
        const initial = (data.campaigns || []).find((c) => c.id === hash) || (data.campaigns || [])[0];
        if (initial) {
          await selectCampaign(initial.id);
        }
      } catch (e) {
        console.error(e);
        alert('Failed to initialize app. Check console for details.');
      }
    })();
    return () => { isMounted = false; };
  }, [selectCampaign]);

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

        <section id="gallery" className="gallery-grid" aria-live="polite">
          {images.map((img, i) => (
            <div className="card" key={`${img.src}-${i}`}>
              <img src={img.src} alt={img.fileName} loading="lazy" onClick={() => openLightbox(i)} />
              <div className="filename">{img.fileName}</div>
            </div>
          ))}
        </section>
      </main>

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


