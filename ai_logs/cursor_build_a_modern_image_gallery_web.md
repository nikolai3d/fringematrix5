# Build a modern image gallery web app
_Exported on 8/8/2025 at 19:19:05 PDT from Cursor (1.4.3)_

---

**User**

Build a single page modern web application that displays the image gallery in a grid from a set called "campaign".  Each of the campaigns is listed in the @campaigns.yaml file, and the icon_path of images is the path in the ./avatars directory. The images are nested deep within each campaigns subdirectory.

Make it look nice and futuristic.

At top and bottom of the site, display a navigation bar, so the user can navigate campaigns. 

Right above the grid, display the information of a campaign, that is also in the @campaigns.yaml file. 

Clicking on each image should display it full-screen, with an option to share on social media and download.



---

**Cursor**

I'll set up a small Node/Express server to read `data/campaigns.yaml`, recursively list images under each campaign's `icon_path` in `avatars`, and serve a modern SPA from `public/` with a futuristic grid gallery, top/bottom navigation, campaign details, and a fullscreen viewer with share/download.

I'll create the necessary files, install dependencies, and run the server locally.

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
    "dev": "NODE_ENV=development node server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "js-yaml": "^4.1.0"
  },
  "engines": {
    "node": ">=18"
  }
}


```

I'm going to add a Node/Express server that reads `data/campaigns.yaml`, serves `/api/campaigns` and `/api/campaigns/:slug/images`, and hosts a modern SPA from `public/` with the requested UI and functionality. After creating files, I'll install dependencies and start the server.

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
app.use(express.static(PUBLIC_DIR, { maxAge: '1d' }));

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
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Fringe Matrix gallery running on http://localhost:${PORT}`);
});


```

Creating the frontend SPA: HTML, CSS, and JS for a futuristic gallery with top/bottom navigation, campaign details, grid, and fullscreen viewer. Then I'll install dependencies and start the server.

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
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="app">
      <header class="navbar" id="top-navbar"></header>

      <main class="content">
        <section id="campaign-info" class="campaign-info"></section>
        <section id="gallery" class="gallery-grid" aria-live="polite"></section>
      </main>

      <footer class="navbar" id="bottom-navbar"></footer>
    </div>

    <div id="lightbox" class="lightbox hidden" aria-hidden="true">
      <button class="lightbox-close" id="lightbox-close" aria-label="Close">✕</button>
      <img id="lightbox-image" alt="Selected image" />
      <div class="lightbox-actions">
        <button id="prev-btn" class="nav-btn" aria-label="Previous">◀</button>
        <div class="spacer"></div>
        <a id="download-btn" class="action-btn" download>Download</a>
        <button id="share-btn" class="action-btn">Share</button>
        <div class="spacer"></div>
        <button id="next-btn" class="nav-btn" aria-label="Next">▶</button>
      </div>
    </div>

    <template id="campaign-pill-template">
      <button class="pill"></button>
    </template>

    <script src="/app.js" type="module"></script>
  </body>
  </html>


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

```javascript
const state = {
  campaigns: [],
  activeCampaignId: null,
  images: [],
  lightboxIndex: 0,
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

function renderNavbars() {
  const top = document.getElementById('top-navbar');
  const bottom = document.getElementById('bottom-navbar');
  top.innerHTML = '';
  bottom.innerHTML = '';

  const template = document.getElementById('campaign-pill-template');

  for (const c of state.campaigns) {
    const pill = template.content.firstElementChild.cloneNode(true);
    pill.textContent = `#${c.hashtag}`;
    pill.classList.toggle('active', c.id === state.activeCampaignId);
    pill.addEventListener('click', () => selectCampaign(c.id));
    top.appendChild(pill.cloneNode(true));
    bottom.appendChild(pill);
  }
}

function renderCampaignInfo() {
  const container = document.getElementById('campaign-info');
  const campaign = state.campaigns.find((c) => c.id === state.activeCampaignId);
  if (!campaign) { container.innerHTML = ''; return; }

  const links = [
    campaign.fringenuity_link && ['Fringenuity', campaign.fringenuity_link],
    campaign.imdb_link && ['IMDB', campaign.imdb_link],
    campaign.wiki_link && ['Wiki', campaign.wiki_link],
  ].filter(Boolean);

  container.innerHTML = '';
  container.append(
    el('h1', {}, `${campaign.episode} (${campaign.episode_id})`),
    el('div', { className: 'campaign-meta' },
      el('span', {}, `Hashtag: #${campaign.hashtag}`),
      el('span', {}, `Air date: ${campaign.date}`),
      el('span', {}, `Path: ${campaign.icon_path}`),
    ),
    el('div', { className: 'campaign-links' }, ...links.map(([label, href]) => el('a', { href, target: '_blank', rel: 'noreferrer noopener' }, label)))
  );
}

function renderGallery() {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  for (let i = 0; i < state.images.length; i += 1) {
    const img = state.images[i];
    const card = el('div', { className: 'card' });
    const image = el('img', { src: img.src, alt: img.fileName, loading: 'lazy' });
    image.addEventListener('click', () => openLightbox(i));
    const caption = el('div', { className: 'filename' }, img.fileName);
    card.append(image, caption);
    gallery.append(card);
  }
}

function openLightbox(index) {
  state.lightboxIndex = index;
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-image');
  const img = state.images[index];
  lbImg.src = img.src;
  lb.classList.remove('hidden');
  lb.setAttribute('aria-hidden', 'false');
  const download = document.getElementById('download-btn');
  download.href = img.src;
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.classList.add('hidden');
  lb.setAttribute('aria-hidden', 'true');
}

function nextImage(delta) {
  if (state.images.length === 0) return;
  state.lightboxIndex = (state.lightboxIndex + delta + state.images.length) % state.images.length;
  const lbImg = document.getElementById('lightbox-image');
  lbImg.src = state.images[state.lightboxIndex].src;
  const download = document.getElementById('download-btn');
  download.href = state.images[state.lightboxIndex].src;
}

async function handleShare() {
  const img = state.images[state.lightboxIndex];
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set('img', img.src);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Fringe Matrix', text: img.fileName, url: shareUrl.toString() });
    } catch {}
  } else {
    await navigator.clipboard.writeText(shareUrl.toString());
    alert('Link copied to clipboard');
  }
}

async function selectCampaign(id) {
  state.activeCampaignId = id;
  window.history.replaceState({}, '', `#${id}`);
  renderNavbars();
  renderCampaignInfo();
  const { images } = await fetchJSON(`/api/campaigns/${id}/images`);
  state.images = images;
  renderGallery();
}

async function init() {
  const { campaigns } = await fetchJSON('/api/campaigns');
  state.campaigns = campaigns;
  const hash = window.location.hash.replace('#', '');
  const initial = campaigns.find((c) => c.id === hash) || campaigns[0];
  renderNavbars();
  if (initial) await selectCampaign(initial.id);

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('next-btn').addEventListener('click', () => nextImage(1));
  document.getElementById('prev-btn').addEventListener('click', () => nextImage(-1));
  document.getElementById('share-btn').addEventListener('click', handleShare);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') nextImage(1);
    else if (e.key === 'ArrowLeft') nextImage(-1);
  });
}

init().catch((e) => {
  console.error(e);
  alert('Failed to initialize app. Check console for details.');
});


```

Installing dependencies and starting the local server. Then you can open http://localhost:3000 to view the gallery.

- Started a Node/Express app that reads `data/campaigns.yaml`, lists images recursively under `avatars/<icon_path>`, and serves an SPA.
- Added a modern, futuristic UI with top/bottom navigation, campaign details above the grid, responsive gallery, and fullscreen viewer with share/download.

How to run:
- npm install
- npm start
- Open http://localhost:3000

Notes:
- Campaigns derive `id` from their `hashtag` via slug; navigation uses these.
- Images are discovered recursively under each campaign’s `icon_path`.

---

**User**

The buttons in the top navigation bar currently don't work, the bottom ones work fine. 

---

**Cursor**

I'll fix the top navbar buttons by ensuring each pill added to the top bar has its own click listener instead of cloning nodes (which doesn't copy event listeners). I'll update `public/app.js` to create separate buttons for the top and bottom navbars with listeners attached.

```javascript
const state = {
  campaigns: [],
  activeCampaignId: null,
  images: [],
  lightboxIndex: 0,
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

function renderNavbars() {
  const top = document.getElementById('top-navbar');
  const bottom = document.getElementById('bottom-navbar');
  top.innerHTML = '';
  bottom.innerHTML = '';

  const template = document.getElementById('campaign-pill-template');

  for (const c of state.campaigns) {
    const pillTop = template.content.firstElementChild.cloneNode(true);
    pillTop.textContent = `#${c.hashtag}`;
    pillTop.classList.toggle('active', c.id === state.activeCampaignId);
    pillTop.addEventListener('click', () => selectCampaign(c.id));
    top.appendChild(pillTop);

    const pillBottom = template.content.firstElementChild.cloneNode(true);
    pillBottom.textContent = `#${c.hashtag}`;
    pillBottom.classList.toggle('active', c.id === state.activeCampaignId);
    pillBottom.addEventListener('click', () => selectCampaign(c.id));
    bottom.appendChild(pillBottom);
  }
}

function renderCampaignInfo() {
  const container = document.getElementById('campaign-info');
  const campaign = state.campaigns.find((c) => c.id === state.activeCampaignId);
  if (!campaign) { container.innerHTML = ''; return; }

  const links = [
    campaign.fringenuity_link && ['Fringenuity', campaign.fringenuity_link],
    campaign.imdb_link && ['IMDB', campaign.imdb_link],
    campaign.wiki_link && ['Wiki', campaign.wiki_link],
  ].filter(Boolean);

  container.innerHTML = '';
  container.append(
    el('h1', {}, `${campaign.episode} (${campaign.episode_id})`),
    el('div', { className: 'campaign-meta' },
      el('span', {}, `Hashtag: #${campaign.hashtag}`),
      el('span', {}, `Air date: ${campaign.date}`),
      el('span', {}, `Path: ${campaign.icon_path}`),
    ),
    el('div', { className: 'campaign-links' }, ...links.map(([label, href]) => el('a', { href, target: '_blank', rel: 'noreferrer noopener' }, label)))
  );
}

function renderGallery() {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  for (let i = 0; i < state.images.length; i += 1) {
    const img = state.images[i];
    const card = el('div', { className: 'card' });
    const image = el('img', { src: img.src, alt: img.fileName, loading: 'lazy' });
    image.addEventListener('click', () => openLightbox(i));
    const caption = el('div', { className: 'filename' }, img.fileName);
    card.append(image, caption);
    gallery.append(card);
  }
}

function openLightbox(index) {
  state.lightboxIndex = index;
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-image');
  const img = state.images[index];
  lbImg.src = img.src;
  lb.classList.remove('hidden');
  lb.setAttribute('aria-hidden', 'false');
  const download = document.getElementById('download-btn');
  download.href = img.src;
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.classList.add('hidden');
  lb.setAttribute('aria-hidden', 'true');
}

function nextImage(delta) {
  if (state.images.length === 0) return;
  state.lightboxIndex = (state.lightboxIndex + delta + state.images.length) % state.images.length;
  const lbImg = document.getElementById('lightbox-image');
  lbImg.src = state.images[state.lightboxIndex].src;
  const download = document.getElementById('download-btn');
  download.href = state.images[state.lightboxIndex].src;
}

async function handleShare() {
  const img = state.images[state.lightboxIndex];
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set('img', img.src);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Fringe Matrix', text: img.fileName, url: shareUrl.toString() });
    } catch {}
  } else {
    await navigator.clipboard.writeText(shareUrl.toString());
    alert('Link copied to clipboard');
  }
}

async function selectCampaign(id) {
  state.activeCampaignId = id;
  window.history.replaceState({}, '', `#${id}`);
  renderNavbars();
  renderCampaignInfo();
  const { images } = await fetchJSON(`/api/campaigns/${id}/images`);
  state.images = images;
  renderGallery();
}

async function init() {
  const { campaigns } = await fetchJSON('/api/campaigns');
  state.campaigns = campaigns;
  const hash = window.location.hash.replace('#', '');
  const initial = campaigns.find((c) => c.id === hash) || campaigns[0];
  renderNavbars();
  if (initial) await selectCampaign(initial.id);

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('next-btn').addEventListener('click', () => nextImage(1));
  document.getElementById('prev-btn').addEventListener('click', () => nextImage(-1));
  document.getElementById('share-btn').addEventListener('click', handleShare);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') nextImage(1);
    else if (e.key === 'ArrowLeft') nextImage(-1);
  });
}

init().catch((e) => {
  console.error(e);
  alert('Failed to initialize app. Check console for details.');
});



```

I fixed the top navbar pills so they’re clickable independently, not cloned without listeners.

- Edit: `public/app.js` `renderNavbars()` now creates separate buttons for the top and bottom bars, each with its own click listener, instead of cloning a single node.
- Action: Hard refresh the browser (Ctrl/Cmd+Shift+R) and try the top nav again.

- Top/bottom navs now both switch campaigns.
- No other behavior changed.

---

**User**

Ok. Update the gitignore file appropriately, and write a README on how to run the website. In the README, note that it's user responsibility right now to place images into a correct path, in the avatars/ subdirectory.

---

**Cursor**

Scanning repo files to adjust .gitignore safely and draft a comprehensive README with run instructions.

```ignore
############################
# Node / general
############################
node_modules/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

.DS_Store
Thumbs.db

.env
.env.*

# Builds / coverage (not used now, but safe to ignore)
dist/
build/
coverage/
.nyc_output/

############################
# App data
############################
# User-provided images; keep out of git by default
avatars/**


```

```markdown
## Fringe Matrix Gallery (2025 Edition)

A futuristic single‑page web app to browse image galleries for Fringe Twitter campaigns.

### Prerequisites
- Node.js 18+ and npm

### Install & Run
1. Install dependencies:
   
   ```bash
   npm install
   ```

2. Start the server:
   
   ```bash
   npm start
   ```

3. Open the app:
   - Visit `http://localhost:3000`

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

### Project structure
- `server.js`: Express server, API endpoints, static hosting
- `public/`: SPA assets (HTML/CSS/JS)
- `data/campaigns.yaml`: Campaign list and metadata
- `avatars/`: Image roots (ignored by git by default)

### Notes
- Campaign IDs are generated from their `hashtag` (slugified); navigation uses these.
- If you add or rename campaigns, restart the server to pick up changes.

```

- Updated `.gitignore` to ignore `node_modules`, logs, env files, build artifacts, and the entire `avatars/` directory so user-supplied images aren’t committed.
- Wrote a concise README with setup/run instructions, how the app works, and a clear note that users must place images under `avatars/` per the `icon_path` entries in `data/campaigns.yaml`.

