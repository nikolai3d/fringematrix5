# Add button for build information
_Exported on 8/9/2025 at 16:17:05 PDT from Cursor (1.4.3)_

---

**User**

Let's add a small button to the bottom-right corner of UI. On click, it should open the small window with the website's build information:
- Github repo (use URL of the origin remote)
- Hash commit of the deployed code.
- Date/Time of the deployment. (Pacific Time Zone, 24 hour format) 


---

**Cursor**

I'll scan the client and server code plus deploy scripts to see how to best add a build info endpoint and a UI button. Then I'll implement the necessary edits in both front-end and server, and update the deploy scripts to generate the build metadata during deployment.

I'll add an API endpoint to return build metadata, update the deployment script to generate a `build-info.json` with repo URL, commit hash, and Pacific deployment time, and add a floating UI button and panel in the client to display this info. Proceeding to implement these edits now.

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3000;

// Project root is one level up from this file (which lives in server/)
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const AVATARS_DIR = path.join(PROJECT_ROOT, 'avatars');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const CLIENT_DIST_DIR = path.join(PROJECT_ROOT, 'client', 'dist');
const HAS_CLIENT_BUILD = fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'));
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'build-info.json');

function loadCampaigns() {
  const yamlPath = path.join(DATA_DIR, 'campaigns.yaml');
  const file = fs.readFileSync(yamlPath, 'utf8');
  const data = yaml.load(file);
  const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
  return campaigns.map((c) => ({
    ...c,
    id: slugify(c.hashtag || c.icon_path || Math.random().toString(36).slice(2)),
  }));
}

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function walkDirectoryRecursive(startDir) {
  const results = [];
  if (!fs.existsSync(startDir)) return results;

  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch (_) {
      continue;
    }
    if (stat.isDirectory()) {
      let children = [];
      try {
        children = fs.readdirSync(current);
      } catch (_) {
        children = [];
      }
      for (const child of children) {
        stack.push(path.join(current, child));
      }
    } else if (stat.isFile()) {
      results.push(current);
    }
  }
  return results;
}

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'].includes(ext);
}

// Static assets
app.use('/avatars', express.static(AVATARS_DIR, {
  fallthrough: true,
  maxAge: '7d',
}));

if (HAS_CLIENT_BUILD) {
  app.use(express.static(CLIENT_DIST_DIR, { maxAge: '1d' }));
} else {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1d' }));
}

// API endpoints
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = loadCampaigns();
    res.json({ campaigns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

app.get('/api/campaigns/:id/images', (req, res) => {
  try {
    const campaigns = loadCampaigns();
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const basePath = campaign.icon_path ? path.join(AVATARS_DIR, campaign.icon_path) : AVATARS_DIR;
    const allFiles = walkDirectoryRecursive(basePath);
    const imageFiles = allFiles.filter(isImageFile);

    const images = imageFiles.map((absPath) => {
      const relativeToAvatars = path.relative(AVATARS_DIR, absPath);
      const urlPath = '/avatars/' + relativeToAvatars.split(path.sep).join('/');
      return {
        src: urlPath,
        fileName: path.basename(absPath),
      };
    });

    res.json({ images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Build info endpoint
app.get('/api/build-info', (req, res) => {
  try {
    if (fs.existsSync(BUILD_INFO_PATH)) {
      const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf8');
      let data;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = {};
      }
      return res.json({
        repoUrl: data.repoUrl || null,
        commitHash: data.commitHash || null,
        deployedAt: data.deployedAt || null,
      });
    }
    return res.json({ repoUrl: null, commitHash: null, deployedAt: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load build info' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  if (HAS_CLIENT_BUILD) {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  } else {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Fringe Matrix backend running on http://localhost:${PORT}`);
});



```

Implementing backend endpoint, client UI button/panel, and deployment script changes. Updating `server/server.js`, `client/src/App.jsx`, `client/src/styles.css`, and `deploy/deploy.ps1` in place. Then I’ll lint the changed files.

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
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);

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
              {buildInfo?.repoUrl ? (
                <a href={buildInfo.repoUrl} target="_blank" rel="noreferrer noopener">{buildInfo.repoUrl}</a>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Commit</span>
              {buildInfo?.commitHash ? (
                <span className="value" title={buildInfo.commitHash}>{buildInfo.commitHash.slice(0, 12)}</span>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Deployed</span>
              <span className="value">{buildInfo?.deployedAt || 'N/A'}</span>
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


/* Build info button and popover */
.build-info-button {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 26;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(0,229,255,0.4);
  background: linear-gradient(135deg, rgba(0,229,255,0.18), rgba(124,77,255,0.18));
  color: var(--fg);
  cursor: pointer;
}
.build-info-button:hover { border-color: var(--accent); box-shadow: 0 6px 16px rgba(0,229,255,0.25); }

.build-info-popover {
  position: fixed;
  right: 12px;
  bottom: 60px;
  width: min(90vw, 380px);
  background: linear-gradient(180deg, rgba(11,17,26,0.98), rgba(11,17,26,0.92));
  border: 1px solid rgba(124,77,255,0.25);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  z-index: 26;
}

.build-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(124,77,255,0.18);
  font-family: Orbitron, Inter, sans-serif;
  letter-spacing: 0.05em;
}

.build-info-close {
  background: transparent;
  color: var(--fg);
  border: none;
  cursor: pointer;
  font-size: 18px;
}

.build-info-body { padding: 10px 12px; display: grid; gap: 8px; }
.build-info-body .row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; }
.build-info-body .label { color: var(--muted); font-size: 13px; }
.build-info-body .value, .build-info-body a { color: #cfe3ff; font-size: 13px; word-break: break-word; }



```

```powershell
param(
  [Parameter(Mandatory=$true)][string]$HostName,
  [Parameter(Mandatory=$true)][string]$User,
  [Parameter(Mandatory=$false)][string]$RemoteDir = "/var/www/fringematrix",
  [Parameter(Mandatory=$false)][string]$AppName = "fringematrix"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# SSH options: fail fast if no key auth, auto-accept new host key
$sshArgs = @('-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new')
$scpArgs = @('-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new')

function New-TempDir {
  $dir = Join-Path $env:TEMP ("fringematrix-" + (Get-Date -Format "yyyyMMddHHmmss"))
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
  New-Item $dir -ItemType Directory | Out-Null
  return $dir
}

Write-Host "Building client locally..." -ForegroundColor Cyan
npm --prefix client install
npm --prefix client run build

$temp = New-TempDir
Write-Host "Staging runtime files in $temp" -ForegroundColor Cyan

# Backend (server/)
Copy-Item server -Destination (Join-Path $temp "server") -Recurse
# Drop local node_modules from the staged backend to reduce archive size
if (Test-Path (Join-Path $temp "server/node_modules")) {
  Remove-Item (Join-Path $temp "server/node_modules") -Recurse -Force
}

# Data and assets
Copy-Item data -Destination (Join-Path $temp "data") -Recurse
if (Test-Path avatars) { Copy-Item avatars -Destination (Join-Path $temp "avatars") -Recurse }

# Built client assets
New-Item (Join-Path $temp "client") -ItemType Directory | Out-Null
Copy-Item client\dist -Destination (Join-Path $temp "client\dist") -Recurse

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repoRoot
try {
  $repoUrl = (git remote get-url origin 2>$null).Trim()
} catch { $repoUrl = $null }
try {
  $commitHash = (git rev-parse HEAD 2>$null).Trim()
} catch { $commitHash = $null }
Pop-Location

# Deployment timestamp in Pacific Time, 24h format with PST/PDT
$tzId = 'Pacific Standard Time'
$tz = [System.TimeZoneInfo]::FindSystemTimeZoneById($tzId)
$nowUtc = [DateTime]::UtcNow
$nowPt = [System.TimeZoneInfo]::ConvertTimeFromUtc($nowUtc, $tz)
$abbr = if ($tz.IsDaylightSavingTime($nowPt)) { 'PDT' } else { 'PST' }
$deployedAt = $nowPt.ToString('yyyy-MM-dd HH:mm:ss') + " $abbr"

$buildInfo = [ordered]@{
  repoUrl    = $repoUrl
  commitHash = $commitHash
  deployedAt = $deployedAt
}
$buildInfoPath = Join-Path $temp 'build-info.json'
($buildInfo | ConvertTo-Json -Depth 3) | Out-File -FilePath $buildInfoPath -Encoding utf8

$archiveName = "release-" + (Get-Date -Format "yyyyMMddHHmmss") + ".tar.gz"
$archivePath = Join-Path $env:TEMP $archiveName

Push-Location $temp
tar -czf $archivePath *
Pop-Location

Write-Host "Uploading $archiveName to ${User}@${HostName}:${RemoteDir}" -ForegroundColor Cyan
ssh @sshArgs "${User}@${HostName}" "mkdir -p '${RemoteDir}/app'" | Out-Null
scp @scpArgs $archivePath "${User}@${HostName}:${RemoteDir}/" | Out-Null

Write-Host "Uploading remote deploy script..." -ForegroundColor Cyan
# Ensure LF endings for the shell script before upload
$remoteShLocal = Join-Path $PSScriptRoot 'deploy_remote.sh'
if (-not (Test-Path $remoteShLocal)) { throw "deploy_remote.sh not found at $remoteShLocal" }
$remoteShTemp = Join-Path $env:TEMP "deploy_remote.sh"
$remoteShContent = (Get-Content -Raw -Encoding UTF8 $remoteShLocal) -replace "`r", ""
[System.IO.File]::WriteAllText($remoteShTemp, $remoteShContent, [System.Text.UTF8Encoding]::new($false))

scp @scpArgs $remoteShTemp "${User}@${HostName}:${RemoteDir}/deploy_remote.sh" | Out-Null
ssh @sshArgs "${User}@${HostName}" "chmod +x '${RemoteDir}/deploy_remote.sh'" | Out-Null

Write-Host "Deploying remotely..." -ForegroundColor Cyan
ssh @sshArgs "${User}@${HostName}" "'${RemoteDir}/deploy_remote.sh' '$RemoteDir' '$archiveName' '$AppName'"

Write-Host "Done. App should be running on port 3000 behind Nginx if configured." -ForegroundColor Green



```

Status: I added a backend endpoint to expose build metadata, a floating button in the UI that opens a small popover with the repo URL, commit hash, and deployment timestamp, and updated the Windows deploy script to generate and ship this metadata. I also added styles. Lint checks passed.

What I changed:
- Backend
  - Added `GET /api/build-info` that reads `build-info.json` at the project root and returns `{ repoUrl, commitHash, deployedAt }`. If missing, returns nulls.
- Frontend
  - Added a bottom-right “info” button. Clicking it opens a compact popover showing:
    - Repo (links to origin remote)
    - Commit hash (shortened)
    - Deployed time (Pacific, 24h)
  - Fetches build info once on first open; shows N/A in dev when not present.
- Deployment (Windows)
  - `deploy/deploy.ps1` now:
    - Builds client, stages files, and writes `build-info.json` at the archive root with:
      - `repoUrl` from `git remote get-url origin`
      - `commitHash` from `git rev-parse HEAD`
      - `deployedAt` in Pacific time with PST/PDT and 24h format (e.g., 2025-01-09 14:37:05 PST)
    - The server reads this file after extraction.

How to use
- Local dev: run the app as usual; the Build Info button appears bottom-right. Values will be N/A unless you deploy using the script.
- Deploy: use `deploy/deploy.ps1` as before; it will embed the build info. The server already serves it via `/api/build-info`.

Edits
- `server/server.js`: added `BUILD_INFO_PATH` and `GET /api/build-info`.
- `client/src/App.jsx`: added build-info button, popover UI, and fetch logic.
- `client/src/styles.css`: added styles for the button and popover.
- `deploy/deploy.ps1`: generate `build-info.json` with repo URL, commit hash, and Pacific timestamp.

If you want the same build-info generation for a non-Windows workflow, I can add it to a cross-platform script or the remote script as well.

---

**User**

JSON looks good and window opens, but the site now errors with this image:

---

**Cursor**

```javascriptreact
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

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [images, setImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);

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
              {buildInfo?.repoUrl ? (
                <a href={buildInfo.repoUrl} target="_blank" rel="noreferrer noopener">{buildInfo.repoUrl}</a>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Commit</span>
              {buildInfo?.commitHash ? (
                <span className="value" title={buildInfo.commitHash}>{buildInfo.commitHash.slice(0, 12)}</span>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Deployed</span>
              <span className="value">{buildInfo?.deployedAt || 'N/A'}</span>
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



```

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3000;

// Project root is one level up from this file (which lives in server/)
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const AVATARS_DIR = path.join(PROJECT_ROOT, 'avatars');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const CLIENT_DIST_DIR = path.join(PROJECT_ROOT, 'client', 'dist');
const HAS_CLIENT_BUILD = fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'));
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'build-info.json');

function loadCampaigns() {
  const yamlPath = path.join(DATA_DIR, 'campaigns.yaml');
  const file = fs.readFileSync(yamlPath, 'utf8');
  const data = yaml.load(file);
  const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
  return campaigns.map((c) => ({
    ...c,
    id: slugify(c.hashtag || c.icon_path || Math.random().toString(36).slice(2)),
  }));
}

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function walkDirectoryRecursive(startDir) {
  const results = [];
  if (!fs.existsSync(startDir)) return results;

  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch (_) {
      continue;
    }
    if (stat.isDirectory()) {
      let children = [];
      try {
        children = fs.readdirSync(current);
      } catch (_) {
        children = [];
      }
      for (const child of children) {
        stack.push(path.join(current, child));
      }
    } else if (stat.isFile()) {
      results.push(current);
    }
  }
  return results;
}

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'].includes(ext);
}

// Static assets
app.use('/avatars', express.static(AVATARS_DIR, {
  fallthrough: true,
  maxAge: '7d',
}));

if (HAS_CLIENT_BUILD) {
  app.use(express.static(CLIENT_DIST_DIR, { maxAge: '1d' }));
} else {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1d' }));
}

// API endpoints
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = loadCampaigns();
    res.json({ campaigns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

app.get('/api/campaigns/:id/images', (req, res) => {
  try {
    const campaigns = loadCampaigns();
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const basePath = campaign.icon_path ? path.join(AVATARS_DIR, campaign.icon_path) : AVATARS_DIR;
    const allFiles = walkDirectoryRecursive(basePath);
    const imageFiles = allFiles.filter(isImageFile);

    const images = imageFiles.map((absPath) => {
      const relativeToAvatars = path.relative(AVATARS_DIR, absPath);
      const urlPath = '/avatars/' + relativeToAvatars.split(path.sep).join('/');
      return {
        src: urlPath,
        fileName: path.basename(absPath),
      };
    });

    res.json({ images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Build info endpoint
app.get('/api/build-info', (req, res) => {
  try {
    if (fs.existsSync(BUILD_INFO_PATH)) {
      const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf8');
      let data;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = {};
      }
      return res.json({
        repoUrl: data.repoUrl || null,
        commitHash: data.commitHash || null,
        deployedAt: data.deployedAt || null,
      });
    }
    return res.json({ repoUrl: null, commitHash: null, deployedAt: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load build info' });
  }
});

// Ensure unknown /api/* paths return JSON (not SPA HTML)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback
app.get('*', (req, res) => {
  if (HAS_CLIENT_BUILD) {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  } else {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Fringe Matrix backend running on http://localhost:${PORT}`);
});



```

Status: I reproduced the likely failure path: the client was parsing HTML (SPA index.html) as JSON when an API path didn’t resolve, causing “Unexpected token ‘<’…”. I updated the server to always return JSON for unknown `/api/*` routes and hardened the client’s JSON parsing to surface clear errors. No linter issues.

What I changed just now:
- Backend
  - Added a JSON 404 handler for all unknown API paths so they never fall through to the SPA:
    - `server/server.js`: added `app.all('/api/*', ...res.status(404).json({ error: 'Not found' }))` before the SPA fallback.
- Frontend
  - Tightened `fetchJSON` to verify the `content-type` is `application/json` and include body snippet/status in thrown errors. This prevents HTML responses from being parsed as JSON and gives clearer debugging info.

Next steps
- Do a quick rebuild/redeploy so these changes take effect.
- Hard refresh the browser and try the Build Info button again.

If it still errors:
- Visit `/api/build-info` directly in the browser and confirm it returns JSON.
- Share the exact response headers/body for that request and I’ll adjust accordingly.

Summary
- Ensured all `/api/*` endpoints return JSON (including 404s) to avoid SPA HTML leaking into API responses.
- Hardened client JSON parsing for clearer diagnostics.
- The Build Info window will keep working; errors should no longer bubble from HTML responses masquerading as JSON.

---

**User**

yep, looks like API is not returning a JSON correctly. How do I call it directly from browser (or from root console) to test it?

---

**Cursor**

### Test from the browser
- Local dev (bypass Vite): open `http://localhost:3000/api/build-info`
- Deployed site (behind Nginx): open `https://yourdomain/api/build-info`

You should see JSON with keys `repoUrl`, `commitHash`, `deployedAt`. If you see HTML, your request isn’t hitting the Express API (likely SPA fallback). In that case, hit port 3000 directly or restart the server.

### Test from a console
- Windows PowerShell:
  - Raw response with headers:
    ```powershell
iwr http://localhost:3000/api/build-info -Headers @{Accept='application/json'} -Method GET -MaximumRedirection 0 -SkipHttpErrorCheck -PassThru | Format-List *
    ```
  - Parsed JSON:
    ```powershell
Invoke-RestMethod http://localhost:3000/api/build-info -Headers @{Accept='application/json'} | ConvertTo-Json
    ```
- Linux/macOS:
  ```bash
curl -i http://127.0.0.1:3000/api/build-info
curl -sS http://127.0.0.1:3000/api/build-info | jq .
  ```

### Quick sanity checks if it’s still HTML
- Unknown API should return JSON 404:
  ```bash
curl -i http://127.0.0.1:3000/api/does-not-exist
  ```
- Confirm the file exists where the server reads it:
  - Local dev project root: `build-info.json`
  - Remote (default paths): `/var/www/fringematrix/app/build-info.json`
- If using pm2 on the server:
  ```bash
pm2 reload fringematrix
  ```

- If Nginx is in front, ensure `location /` proxies to the Node app (no rewrite of `/api/*`).

```powershell
iwr http://localhost:3000/api/build-info -Headers @{Accept='application/json'} -Method GET -MaximumRedirection 0 -SkipHttpErrorCheck -PassThru | Format-List *
```

```powershell
Invoke-RestMethod http://localhost:3000/api/build-info -Headers @{Accept='application/json'} | ConvertTo-Json
```

```shellscript
curl -i http://127.0.0.1:3000/api/build-info
curl -sS http://127.0.0.1:3000/api/build-info | jq .
```

```shellscript
curl -i http://127.0.0.1:3000/api/does-not-exist
```

```shellscript
pm2 reload fringematrix
```

---

**User**

both endpoints just return default HTML:
```
root@ubuntu-s-1vcpu-1gb-35gb-intel-sfo3-01:/var/www/fringematrix/app# curl -i http://127.0.0.1:3000/api/does-not-exist
HTTP/1.1 200 OK
X-Powered-By: Express
Accept-Ranges: bytes
Cache-Control: public, max-age=0
Last-Modified: Sat, 09 Aug 2025 22:59:55 GMT
ETag: W/"2c4-198910fe5f8"
Content-Type: text/html; charset=UTF-8
Content-Length: 708
Date: Sat, 09 Aug 2025 23:03:04 GMT
Connection: keep-alive
Keep-Alive: timeout=5

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fringe Matrix Gallery</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400..900&family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="/assets/index-CyHwRf3E.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-zqkN6Z8G.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
  </html>
```


---

**Cursor**

I’m going to move the static file serving to occur after all `/api` routes so that API requests can’t be intercepted by the SPA fallback, which is what’s causing HTML to be returned for API URLs. Then I’ll suggest commands for you to run on the server to verify and restart.

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3000;

// Project root is one level up from this file (which lives in server/)
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const AVATARS_DIR = path.join(PROJECT_ROOT, 'avatars');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const CLIENT_DIST_DIR = path.join(PROJECT_ROOT, 'client', 'dist');
const HAS_CLIENT_BUILD = fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'));
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'build-info.json');

function loadCampaigns() {
  const yamlPath = path.join(DATA_DIR, 'campaigns.yaml');
  const file = fs.readFileSync(yamlPath, 'utf8');
  const data = yaml.load(file);
  const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
  return campaigns.map((c) => ({
    ...c,
    id: slugify(c.hashtag || c.icon_path || Math.random().toString(36).slice(2)),
  }));
}

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function walkDirectoryRecursive(startDir) {
  const results = [];
  if (!fs.existsSync(startDir)) return results;

  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch (_) {
      continue;
    }
    if (stat.isDirectory()) {
      let children = [];
      try {
        children = fs.readdirSync(current);
      } catch (_) {
        children = [];
      }
      for (const child of children) {
        stack.push(path.join(current, child));
      }
    } else if (stat.isFile()) {
      results.push(current);
    }
  }
  return results;
}

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'].includes(ext);
}

// Static assets (avatars) — keep separate from SPA assets
app.use('/avatars', express.static(AVATARS_DIR, {
  fallthrough: true,
  maxAge: '7d',
}));

// API endpoints
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = loadCampaigns();
    res.json({ campaigns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

app.get('/api/campaigns/:id/images', (req, res) => {
  try {
    const campaigns = loadCampaigns();
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const basePath = campaign.icon_path ? path.join(AVATARS_DIR, campaign.icon_path) : AVATARS_DIR;
    const allFiles = walkDirectoryRecursive(basePath);
    const imageFiles = allFiles.filter(isImageFile);

    const images = imageFiles.map((absPath) => {
      const relativeToAvatars = path.relative(AVATARS_DIR, absPath);
      const urlPath = '/avatars/' + relativeToAvatars.split(path.sep).join('/');
      return {
        src: urlPath,
        fileName: path.basename(absPath),
      };
    });

    res.json({ images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Build info endpoint
app.get('/api/build-info', (req, res) => {
  try {
    if (fs.existsSync(BUILD_INFO_PATH)) {
      const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf8');
      let data;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = {};
      }
      return res.json({
        repoUrl: data.repoUrl || null,
        commitHash: data.commitHash || null,
        deployedAt: data.deployedAt || null,
      });
    }
    return res.json({ repoUrl: null, commitHash: null, deployedAt: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load build info' });
  }
});

// Ensure unknown /api/* paths return JSON (not SPA HTML)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Serve SPA assets AFTER API routes so /api/* never falls through to HTML
if (HAS_CLIENT_BUILD) {
  app.use(express.static(CLIENT_DIST_DIR, { maxAge: '1d' }));
} else {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1d' }));
}

// SPA fallback
app.get('*', (req, res) => {
  if (HAS_CLIENT_BUILD) {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  } else {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Fringe Matrix backend running on http://localhost:${PORT}`);
});



```

Status: I moved SPA static serving to occur after all `/api/*` routes so API requests don’t get caught by the HTML fallback. This should stop HTML being returned for API URLs.

What to run on the server
- Reload the app:
  - If using pm2:
    - pm2 reload fringematrix
  - Or restart your server process however you normally do.
- Verify API behavior:
  - JSON 404 for unknown API:
    - curl -i http://127.0.0.1:3000/api/does-not-exist
      - Expect: HTTP/1.1 404 with Content-Type: application/json
  - Build info:
    - curl -i http://127.0.0.1:3000/api/build-info
      - Expect: 200 JSON with keys repoUrl, commitHash, deployedAt

If you still get HTML, please paste:
- The response headers for curl -i http://127.0.0.1:3000/api/does-not-exist
- The pm2 logs around startup (pm2 logs fringematrix --lines 100)

Summary
- Adjusted routing order in `server/server.js` so `/api/*` routes and JSON 404 handler are evaluated before static SPA middleware and fallback. This prevents HTML responses for API paths.

---

**User**

OK looks like it's fixed.
Now let's make some tweaks to the window:

* Full commit hash should be displayed.
* Window should be a bit wider so the URL does not wrap around.
* Day in the timestamp should be in format "August 9th, 2025, ..." for better readability.



---

**Cursor**

Making the UI tweaks: widen the build info popover, prevent URL wrapping, show full commit hash, and add friendly date formatting. Then I’ll run lint checks on the updated files.

```javascriptreact
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

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [images, setImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);

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
              {buildInfo?.repoUrl ? (
                <a href={buildInfo.repoUrl} target="_blank" rel="noreferrer noopener">{buildInfo.repoUrl}</a>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Commit</span>
              {buildInfo?.commitHash ? (
                <span className="value" title={buildInfo.commitHash}>{buildInfo.commitHash.slice(0, 12)}</span>
              ) : (
                <span className="value">N/A</span>
              )}
            </div>
            <div className="row">
              <span className="label">Deployed</span>
              <span className="value">{buildInfo?.deployedAt || 'N/A'}</span>
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



```

```javascriptreact
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

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [images, setImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);

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
              {buildInfo?.repoUrl ? (
                <a href={buildInfo.repoUrl} target="_blank" rel="noreferrer noopener">{buildInfo.repoUrl}</a>
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


/* Build info button and popover */
.build-info-button {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 26;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(0,229,255,0.4);
  background: linear-gradient(135deg, rgba(0,229,255,0.18), rgba(124,77,255,0.18));
  color: var(--fg);
  cursor: pointer;
}
.build-info-button:hover { border-color: var(--accent); box-shadow: 0 6px 16px rgba(0,229,255,0.25); }

.build-info-popover {
  position: fixed;
  right: 12px;
  bottom: 60px;
  width: min(95vw, 520px);
  background: linear-gradient(180deg, rgba(11,17,26,0.98), rgba(11,17,26,0.92));
  border: 1px solid rgba(124,77,255,0.25);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  z-index: 26;
}

.build-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(124,77,255,0.18);
  font-family: Orbitron, Inter, sans-serif;
  letter-spacing: 0.05em;
}

.build-info-close {
  background: transparent;
  color: var(--fg);
  border: none;
  cursor: pointer;
  font-size: 18px;
}

.build-info-body { padding: 10px 12px; display: grid; gap: 8px; }
.build-info-body .row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; }
.build-info-body .label { color: var(--muted); font-size: 13px; }
.build-info-body .value, .build-info-body a { color: #cfe3ff; font-size: 13px; word-break: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.build-info-body a { text-decoration: underline; text-decoration-style: dotted; }
.build-info-body .monospace { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }



```

Status: Implemented the requested UI tweaks: full commit hash, wider popover, non-wrapping URL, and friendlier timestamp formatting with ordinals. Lint checks passed.

What changed
- `client/src/App.jsx`
  - Show full commit hash (monospace) instead of truncating.
  - Added date formatting utils to render like “August 9th, 2025, 16:07:19 PDT”.
- `client/src/styles.css`
  - Increased popover width to `min(95vw, 520px)`.
  - Prevent URL wrapping and added ellipsis overflow.
  - Monospace style for commit hash.

You can refresh and open the Build Info to see:
- Full commit hash
- Wider window, link doesn’t wrap
- Timestamp in “Month DayOrdinal, Year, HH:MM:SS TZ” format

Summary
- UI: wider build info popover; URL kept on one line; commit hash shown in full; date formatted with ordinals.

