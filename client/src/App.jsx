import React, { useEffect, useMemo, useState, useCallback } from 'react';

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`Failed to fetch ${url} (status ${res.status}). ${body?.slice(0, 200) || ''}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`Expected JSON from ${url} but got '${contentType}'. Body starts: ${body.slice(0, 80)}`);
  }
  return res.json();
}

function ordinalize(dayNumber) {
  const n = Number(dayNumber);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function formatDeployedAtPacific(ptString) {
  if (!ptString || typeof ptString !== 'string') return ptString;
  const m = ptString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) (P[SD]T)$/);
  if (!m) return ptString;
  const [, yyyy, mm, dd, HH, MM, SS, tz] = m;
  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const monthName = monthNames[Number(mm) - 1] || mm;
  const day = ordinalize(Number(dd));
  return `${monthName} ${day}, ${yyyy}, ${HH}:${MM}:${SS} ${tz}`;
}

// Convert various git remote URL formats into a clean HTTPS URL suitable for display/clicking
function gitRemoteToHttps(remote) {
  if (!remote || typeof remote !== 'string') return '';
  const trimmed = remote.trim();

  // Handle scp-like syntax: git@host:owner/repo.git
  const scpLikeMatch = trimmed.match(/^[\w.-]+@([^:]+):(.+)$/);
  if (scpLikeMatch) {
    const host = scpLikeMatch[1];
    let path = scpLikeMatch[2];
    if (path.endsWith('.git')) path = path.slice(0, -4);
    return `https://${host}/${path}`;
  }

  // Normalize common protocols to https
  let candidate = trimmed.replace(/^git\+/, '');
  candidate = candidate.replace(/^git:\/\//, 'https://');
  candidate = candidate.replace(/^ssh:\/\//, 'https://');
  candidate = candidate.replace(/^http:\/\//, 'https://');

  try {
    const u = new URL(candidate);
    let path = u.pathname || '';
    if (path.startsWith('/')) path = path.slice(1);
    if (path.endsWith('.git')) path = path.slice(0, -4);
    if (!u.hostname || !path) return '';
    return `https://${u.hostname}/${path}`;
  } catch {
    // As a last resort, if it looks like host/path(.git)
    const bare = candidate.replace(/^\/*/, '');
    const m = bare.match(/^([^/]+)\/(.+)$/);
    if (m) {
      let path = m[2];
      if (path.endsWith('.git')) path = path.slice(0, -4);
      return `https://${m[1]}/${path}`;
    }
  }
  return '';
}

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [images, setImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);

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
  const toggleBuildInfo = useCallback(async () => {
    setIsBuildInfoOpen((v) => !v);
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

      {/* Build info button */}
      <button
        className="build-info-button"
        aria-label="Build information"
        onClick={toggleBuildInfo}
      >
        ⓘ
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


