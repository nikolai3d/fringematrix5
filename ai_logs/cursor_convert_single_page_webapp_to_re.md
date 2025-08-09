# Convert single-page webapp to React
_Exported on 8/8/2025 at 20:06:21 PDT from Cursor (1.4.3)_

---

**User**

Make this single-page webapp a react app

---

**Cursor**

I'll first scan the current frontend and server files to understand how the app works so I can convert it to React with minimal breakage. Then I'll set up a modern React build (Vite), migrate the existing JS/CSS/HTML into React components and structure, and update the server to serve the built app.

Scanning the current SPA code and server to plan the React migration. I'll add a Vite-powered React frontend under `client/`, migrate the UI into React components, proxy API/avatars during dev, update the server to serve the built React app in production, and wire up scripts. Then I'll install dependencies and build to verify.

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const AVATARS_DIR = path.join(ROOT_DIR, 'avatars');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'client', 'dist');
const HAS_CLIENT_BUILD = fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'));

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

// SPA fallback
app.get('*', (req, res) => {
  if (HAS_CLIENT_BUILD) {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  } else {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Fringe Matrix gallery running on http://localhost:${PORT}`);
});



```

```json
{
  "name": "fringematrix5",
  "version": "1.0.0",
  "private": true,
  "description": "Fringe Matrix Gallery - futuristic SPA to browse campaign image galleries",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "server": "node server.js",
    "dev": "concurrently -n server,client -c blue,green \"npm run server\" \"npm run client:dev\"",
    "client:dev": "npm run dev --prefix client",
    "client:build": "npm run build --prefix client",
    "client:preview": "npm run preview --prefix client",
    "build": "npm run client:build"
  },
  "dependencies": {
    "express": "^4.19.2",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  },
  "engines": {
    "node": ">=18"
  }
}



```

```json
{
  "name": "fringematrix-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}


```

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/avatars': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});


```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fringe Matrix Gallery</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400..900&family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
  </html>


```

```javascriptreact
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const rootElement = document.getElementById('root');
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


```

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
        {campaigns.map((c) => (
          <button
            key={c.id}
            className={`pill${c.id === activeCampaignId ? ' active' : ''}`}
            onClick={() => selectCampaign(c.id)}
          >
            #{c.hashtag}
          </button>
        ))}
      </header>

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
        {campaigns.map((c) => (
          <button
            key={c.id}
            className={`pill${c.id === activeCampaignId ? ' active' : ''}`}
            onClick={() => selectCampaign(c.id)}
          >
            #{c.hashtag}
          </button>
        ))}
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
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  padding: 14px 16px;
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

.pill {
  background: linear-gradient(135deg, rgba(0,229,255,0.12), rgba(124,77,255,0.12));
  color: var(--fg);
  border: 1px solid rgba(0,229,255,0.35);
  padding: 10px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-family: Orbitron, Inter, sans-serif;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  transition: transform .15s ease, box-shadow .2s ease, border-color .2s ease;
}
.pill:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,229,255,0.2); border-color: rgba(124,77,255,0.7); }
.pill.active { background: linear-gradient(135deg, rgba(0,229,255,0.25), rgba(124,77,255,0.25)); border-color: var(--accent); }

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

@media (min-width: 900px) {
  .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
}


```

I created a React frontend (Vite) under `client/`, migrated the UI into React components, copied styles, added a dev proxy to your Node server, and updated `server.js` to serve the React build in production while keeping the legacy `public/` fallback if no build exists. I'll install dependencies and start the dev servers now.

- Spun up a React app with Vite in `client/` and migrated your SPA to React (`client/src/App.jsx`, `client/src/main.jsx`), preserving functionality and UI.
- Copied styles to `client/src/styles.css` and kept Google Fonts in `client/index.html`.
- Configured dev proxy in `client/vite.config.js` so `/api` and `/avatars` hit your Node server during development.
- Updated `server.js` to serve `client/dist` when built, falling back to `public/` if no build exists.
- Added scripts to `package.json` to run server and client together via `npm run dev`; installed dependencies and started both in the background.

Next:
- Access the app at `http://localhost:5173` for the React dev server (API proxied to `http://localhost:3000`).
- For production: `npm run build` then `npm start` serves the built React app from `client/dist`.

If you want, I can delete the old `public/app.js` and update `public/index.html` to a minimal fallback, or keep them as legacy until you confirm.

---

**User**

Everything works fine, let's delete the old files and update the readme.

---

**Cursor**

I’m going to remove the legacy static frontend files in `public/` and update `README.md` with React/Vite usage instructions.

Deleting the legacy `public/` frontend files and updating `README.md` with React/Vite instructions.

```markdown
## Fringe Matrix Gallery (2025 Edition)

A futuristic single‑page web app to browse image galleries for Fringe Twitter campaigns.

### Prerequisites
- Node.js 18+ and npm

### Install & Run (development)
1. Install dependencies:
   
   ```bash
   npm install
   npm --prefix client install
   ```

2. Start dev servers (API at 3000, React at 5173):
   
   ```bash
   npm run dev
   ```

3. Open the app:
   - Visit `http://localhost:5173`

### How it works
- The server reads campaign metadata from `data/campaigns.yaml`.
- Each campaign has an `icon_path` that points inside the `avatars/` directory.
- The server recursively lists all image files found under that campaign’s `icon_path` and renders them in a responsive grid.
- Clicking an image opens a fullscreen viewer with next/prev, share, and download.
- Top and bottom navigation bars let you switch between campaigns.

### Providing images (your responsibility)
- You must place image files into the correct path under the `avatars/` directory yourself.
- The `icon_path` values in `data/campaigns.yaml` are relative to `avatars/`.
- Example: if a campaign has `icon_path: "Season4/CrossTheLine"`, put images under:
  - `avatars/Season4/CrossTheLine/...` (can be nested further)

Supported image extensions: `.png .jpg .jpeg .gif .webp .avif .bmp .svg`.

### Build & Run (production)
1. Build React app:
   
   ```bash
   npm run build
   ```

2. Start server (serves `client/dist` if present):
   
   ```bash
   npm start
   ```

3. Open the app:
   - Visit `http://localhost:3000`

### Project structure
- `server.js`: Express server, API endpoints, static hosting
- `client/`: React app (Vite)
- `data/campaigns.yaml`: Campaign list and metadata
- `avatars/`: Image roots (ignored by git by default)

### Notes
- Campaign IDs are generated from their `hashtag` (slugified); navigation uses these.
- If you add or rename campaigns, restart the server to pick up changes.

```

- Deleted legacy `public/` files: `app.js`, `index.html`, `styles.css`.
- Updated `README.md` with dev (Vite) and prod build/run instructions, new project structure, and dev proxy info implied by ports.

You can now:
- Dev: run `npm run dev` and open `http://localhost:5173`.
- Prod: `npm run build` then `npm start` (serves `client/dist` at `http://localhost:3000`).

