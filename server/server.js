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
const IS_DEV = process.env.NODE_ENV !== 'production';

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

// Ensure a dev build-info.json exists locally for debugging locally
function ensureDevBuildInfo() {
  try {
    const shouldCreateDevInfo = (!fs.existsSync(BUILD_INFO_PATH)) && (IS_DEV || !HAS_CLIENT_BUILD);
    if (shouldCreateDevInfo) {
      const devInfo = {
        repoUrl: null,
        commitHash: 'DEV-LOCAL',
        deployedAt: new Date().toISOString(),
      };
      fs.writeFileSync(BUILD_INFO_PATH, JSON.stringify(devInfo, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('Could not create dev build-info.json:', err.message);
  }
}

ensureDevBuildInfo();

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
    if (IS_DEV || !HAS_CLIENT_BUILD) {
      return res.json({ repoUrl: null, commitHash: 'DEV-LOCAL', deployedAt: new Date().toISOString() });
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

// Only start the server if this file is executed directly (not when imported for tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Fringe Matrix backend running on http://localhost:${PORT}`);
  });
}

// Export the app for testing
module.exports = app;
