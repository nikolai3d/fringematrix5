# Redesign navigation UI with sidebar
_Exported on 8/8/2025 at 20:06:38 PDT from Cursor (1.4.3)_

---

**User**

Let's change the navigation UI. Instead of top and bottom button bars, let's make a vertical sidebar that is hidden by default, when unhidden it lists all the campaign buttons vertically on the side. 

The top and bottom navigation bars are still there but should be much smaller with just 
- name of the current campaign in large font, in the center.
- to the right of current campaign name, the "right arrow" button for next campaign 
- to the left of current campaign name, the "left arrow" button for previous campaign.

Campaign buttons loop, i.e. when you are on a last campaign and click a next campaign button, it should loop back to the first campaign, and vice versa for previous campaign button. 


---

**Cursor**

I'll scan the existing React components and styles to see how navigation is currently implemented and then update them to add a toggleable vertical sidebar and adjust the top/bottom bars, including looping campaign navigation.

I’m going to update `client/src/App.jsx` to add a hidden-by-default vertical sidebar for campaign buttons, simplify the top and bottom navigation bars to show only the current campaign name and previous/next arrows with looping behavior, and then add corresponding styles in `client/src/styles.css` for the new layout and components.

```javascriptreact
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
        aria-label="Toggle campaign list"
        onClick={toggleSidebar}
      >
        ☰
      </button>

      <aside className={`sidebar${isSidebarOpen ? ' open' : ''}`} aria-hidden={!isSidebarOpen}>
        <div className="sidebar-header">Campaigns</div>
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



```

```css
:root {
  --bg: #06090f;
  --bg-elev: #0b111a;
  --fg: #e6f0ff;
  --muted: #89a0b3;
  --accent: #00e5ff;
  --accent-2: #7c4dff;
  --grid-gap: 14px;
}

* { box-sizing: border-box; }

html, body { height: 100%; }
body {
  margin: 0;
  background: radial-gradient(1000px 600px at 80% -10%, rgba(0,229,255,0.15), transparent),
              radial-gradient(800px 500px at 10% 110%, rgba(124,77,255,0.12), transparent),
              var(--bg);
  color: var(--fg);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  background: linear-gradient(180deg, rgba(11,17,26,0.95), rgba(11,17,26,0.7));
  backdrop-filter: blur(6px);
  border-bottom: 1px solid rgba(0,229,255,0.15);
}

footer.navbar {
  top: auto;
  bottom: 0;
  border-top: 1px solid rgba(124,77,255,0.15);
  border-bottom: none;
}

/* compact navbar inner layout */
.navbar-inner {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
  width: min(900px, 100%);
}

.current-campaign {
  text-align: center;
  font-family: Orbitron, Inter, sans-serif;
  font-size: 20px;
  letter-spacing: 0.04em;
  font-weight: 700;
}

.nav-arrow {
  background: transparent;
  color: var(--fg);
  border: 1px solid rgba(0,229,255,0.35);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}
.nav-arrow:hover { border-color: var(--accent); box-shadow: 0 4px 12px rgba(0,229,255,0.2); }

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.campaign-info {
  margin: 16px 0 8px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(11,17,26,0.85), rgba(11,17,26,0.6));
  border: 1px solid rgba(124,77,255,0.25);
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.campaign-info h1 {
  font-family: Orbitron, Inter, sans-serif;
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.04em;
}
.campaign-meta { color: var(--muted); font-size: 14px; display: flex; gap: 14px; flex-wrap: wrap; }
.campaign-links { margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
.campaign-links a { color: var(--accent); text-decoration: none; border-bottom: 1px dashed rgba(0,229,255,0.5); }

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--grid-gap);
  margin: 18px 0 80px;
}

.card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-elev);
  border: 1px solid rgba(124,77,255,0.2);
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
  cursor: zoom-in;
}

.card img { width: 100%; height: 100%; display: block; object-fit: cover; aspect-ratio: 1 / 1; }
.card .filename { position: absolute; left: 8px; bottom: 8px; right: 8px; font-size: 12px; color: #cfe3ff; text-shadow: 0 2px 6px rgba(0,0,0,0.9); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(3,6,10,0.9);
  display: grid;
  place-items: center;
  z-index: 50;
}
.lightbox.hidden { display: none; }
.lightbox img { max-width: 95vw; max-height: 80vh; border-radius: 10px; border: 1px solid rgba(0,229,255,0.25); box-shadow: 0 10px 50px rgba(0,0,0,0.6); }
.lightbox-actions {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
}
.lightbox-close { position: fixed; top: 14px; right: 16px; background: transparent; color: var(--fg); border: none; font-size: 28px; cursor: pointer; }
.action-btn, .nav-btn { background: linear-gradient(180deg, rgba(0,229,255,0.15), rgba(124,77,255,0.15)); color: var(--fg); border: 1px solid rgba(0,229,255,0.35); padding: 10px 14px; border-radius: 10px; cursor: pointer; text-decoration: none; }
.action-btn:hover, .nav-btn:hover { border-color: var(--accent); box-shadow: 0 4px 16px rgba(0,229,255,0.25); }
.spacer { inline-size: 10px; }

/* Sidebar */
.sidebar-toggle {
  position: fixed;
  left: 12px;
  top: 12px;
  z-index: 25;
  background: linear-gradient(135deg, rgba(0,229,255,0.18), rgba(124,77,255,0.18));
  border: 1px solid rgba(0,229,255,0.4);
  color: var(--fg);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
}
.sidebar-toggle.open { border-color: var(--accent); }

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(78vw, 320px);
  background: linear-gradient(180deg, rgba(11,17,26,0.98), rgba(11,17,26,0.92));
  border-right: 1px solid rgba(0,229,255,0.2);
  transform: translateX(-100%);
  transition: transform .25s ease;
  z-index: 24;
  display: flex;
  flex-direction: column;
}
.sidebar.open { transform: translateX(0); }

.sidebar-header {
  padding: 16px;
  font-family: Orbitron, Inter, sans-serif;
  font-size: 16px;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(0,229,255,0.18);
}

.sidebar-list {
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-item {
  text-align: left;
  background: linear-gradient(135deg, rgba(0,229,255,0.12), rgba(124,77,255,0.12));
  color: var(--fg);
  border: 1px solid rgba(0,229,255,0.35);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-family: Orbitron, Inter, sans-serif;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.sidebar-item:hover { border-color: var(--accent); box-shadow: 0 6px 16px rgba(0,229,255,0.2); }
.sidebar-item.active { background: linear-gradient(135deg, rgba(0,229,255,0.25), rgba(124,77,255,0.25)); border-color: var(--accent); }

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 23;
}

@media (min-width: 900px) {
  .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
}



```

I updated the UI: added a toggleable vertical sidebar for campaigns, simplified the top/bottom navbars to show the current campaign and prev/next arrows, and implemented looping between campaigns. Now I'll check for any lint issues in the modified files.

### Changes implemented
- Vertical sidebar
  - Hidden by default, toggled with a button (☰) near the top-left.
  - Lists all campaigns vertically; clicking a campaign selects it and closes the sidebar.
- Top and bottom bars simplified
  - Center: large current campaign name (e.g., `#SomeHashtag`).
  - Left/Right: arrows to go to previous/next campaign.
  - Campaign navigation loops from last→first and first→last.

### Key edits
- Updated `client/src/App.jsx`
  - Added `isSidebarOpen`, `toggleSidebar`, and overlay.
  - Implemented `activeIndex`, `goToNextCampaign`, `goToPrevCampaign` with looping.
  - Replaced pill lists in `header`/`footer` with compact center title + arrows.
  - Added `aside.sidebar` markup for vertical campaign list.
- Updated `client/src/styles.css`
  - Compact navbar layout via `.navbar-inner`, `.current-campaign`, `.nav-arrow`.
  - Sidebar styles: `.sidebar`, `.sidebar-toggle`, `.sidebar-list`, `.sidebar-item`, `.sidebar-overlay`.
  - Removed pill button styling from navbar context.

You can now toggle the sidebar and navigate campaigns with looping via the arrows.

---

**User**

Looks great, but the sidebar, when opened, overlaps the sidebar button with the "campaigns" word, see attached screenshot. The header should also say "All Campaigns", not just "campaigns"

---

**Cursor**

I’m going to adjust the sidebar toggle so it shifts to the right when the sidebar is open (avoiding overlap) and changes to an “×” icon, and I’ll update the sidebar header text to “All Campaigns.” Then I’ll run a quick lint check.

```javascriptreact
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



```

```css
:root {
  --bg: #06090f;
  --bg-elev: #0b111a;
  --fg: #e6f0ff;
  --muted: #89a0b3;
  --accent: #00e5ff;
  --accent-2: #7c4dff;
  --grid-gap: 14px;
}

* { box-sizing: border-box; }

html, body { height: 100%; }
body {
  margin: 0;
  background: radial-gradient(1000px 600px at 80% -10%, rgba(0,229,255,0.15), transparent),
              radial-gradient(800px 500px at 10% 110%, rgba(124,77,255,0.12), transparent),
              var(--bg);
  color: var(--fg);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  background: linear-gradient(180deg, rgba(11,17,26,0.95), rgba(11,17,26,0.7));
  backdrop-filter: blur(6px);
  border-bottom: 1px solid rgba(0,229,255,0.15);
}

footer.navbar {
  top: auto;
  bottom: 0;
  border-top: 1px solid rgba(124,77,255,0.15);
  border-bottom: none;
}

/* compact navbar inner layout */
.navbar-inner {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
  width: min(900px, 100%);
}

.current-campaign {
  text-align: center;
  font-family: Orbitron, Inter, sans-serif;
  font-size: 20px;
  letter-spacing: 0.04em;
  font-weight: 700;
}

.nav-arrow {
  background: transparent;
  color: var(--fg);
  border: 1px solid rgba(0,229,255,0.35);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}
.nav-arrow:hover { border-color: var(--accent); box-shadow: 0 4px 12px rgba(0,229,255,0.2); }

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.campaign-info {
  margin: 16px 0 8px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(11,17,26,0.85), rgba(11,17,26,0.6));
  border: 1px solid rgba(124,77,255,0.25);
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.campaign-info h1 {
  font-family: Orbitron, Inter, sans-serif;
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.04em;
}
.campaign-meta { color: var(--muted); font-size: 14px; display: flex; gap: 14px; flex-wrap: wrap; }
.campaign-links { margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
.campaign-links a { color: var(--accent); text-decoration: none; border-bottom: 1px dashed rgba(0,229,255,0.5); }

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--grid-gap);
  margin: 18px 0 80px;
}

.card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-elev);
  border: 1px solid rgba(124,77,255,0.2);
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
  cursor: zoom-in;
}

.card img { width: 100%; height: 100%; display: block; object-fit: cover; aspect-ratio: 1 / 1; }
.card .filename { position: absolute; left: 8px; bottom: 8px; right: 8px; font-size: 12px; color: #cfe3ff; text-shadow: 0 2px 6px rgba(0,0,0,0.9); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(3,6,10,0.9);
  display: grid;
  place-items: center;
  z-index: 50;
}
.lightbox.hidden { display: none; }
.lightbox img { max-width: 95vw; max-height: 80vh; border-radius: 10px; border: 1px solid rgba(0,229,255,0.25); box-shadow: 0 10px 50px rgba(0,0,0,0.6); }
.lightbox-actions {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
}
.lightbox-close { position: fixed; top: 14px; right: 16px; background: transparent; color: var(--fg); border: none; font-size: 28px; cursor: pointer; }
.action-btn, .nav-btn { background: linear-gradient(180deg, rgba(0,229,255,0.15), rgba(124,77,255,0.15)); color: var(--fg); border: 1px solid rgba(0,229,255,0.35); padding: 10px 14px; border-radius: 10px; cursor: pointer; text-decoration: none; }
.action-btn:hover, .nav-btn:hover { border-color: var(--accent); box-shadow: 0 4px 16px rgba(0,229,255,0.25); }
.spacer { inline-size: 10px; }

/* Sidebar */
.sidebar-toggle {
  position: fixed;
  left: 12px;
  top: 12px;
  z-index: 25;
  background: linear-gradient(135deg, rgba(0,229,255,0.18), rgba(124,77,255,0.18));
  border: 1px solid rgba(0,229,255,0.4);
  color: var(--fg);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
}
.sidebar-toggle.open { border-color: var(--accent); left: calc(min(78vw, 320px) + 16px); }

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(78vw, 320px);
  background: linear-gradient(180deg, rgba(11,17,26,0.98), rgba(11,17,26,0.92));
  border-right: 1px solid rgba(0,229,255,0.2);
  transform: translateX(-100%);
  transition: transform .25s ease;
  z-index: 24;
  display: flex;
  flex-direction: column;
}
.sidebar.open { transform: translateX(0); }

.sidebar-header {
  padding: 16px;
  font-family: Orbitron, Inter, sans-serif;
  font-size: 16px;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(0,229,255,0.18);
}

.sidebar-list {
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-item {
  text-align: left;
  background: linear-gradient(135deg, rgba(0,229,255,0.12), rgba(124,77,255,0.12));
  color: var(--fg);
  border: 1px solid rgba(0,229,255,0.35);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-family: Orbitron, Inter, sans-serif;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.sidebar-item:hover { border-color: var(--accent); box-shadow: 0 6px 16px rgba(0,229,255,0.2); }
.sidebar-item.active { background: linear-gradient(135deg, rgba(0,229,255,0.25), rgba(124,77,255,0.25)); border-color: var(--accent); }

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 23;
}

@media (min-width: 900px) {
  .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
}



```

- Updated the sidebar header text to say “All Campaigns.”
- Sidebar toggle now switches to “✕” when open and shifts to the right (`left: calc(min(78vw, 320px) + 16px)`) to avoid overlapping the header text.

If you want the toggle to sit flush with the sidebar edge on all viewport sizes, we can also vertically center it or anchor it inside the sidebar panel—just say the word.

