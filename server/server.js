const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { list } = require('@vercel/blob');

// Auto-load .env.local if it exists (like in our migration script)
const ENV_LOCAL_PATH = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(ENV_LOCAL_PATH)) {
  const envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
  const envVars = envContent
    .split('\n')
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .reduce((acc, line) => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      acc[key.trim()] = value;
      return acc;
    }, {});
  
  // Set environment variables if they're not already set
  Object.entries(envVars).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
  
  console.log('📋 Loaded environment variables from .env.local');
  console.log('🔑 BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? 'FOUND' : 'MISSING');
}

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

// Simple cache for blob listings to reduce API calls during testing
const blobCache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache during development/testing
const HAS_BLOB_TOKEN = !!process.env.BLOB_READ_WRITE_TOKEN;

async function listBlobsWithCache(options) {
  // If no blob token is available (e.g., in CI), return empty results
  if (!HAS_BLOB_TOKEN) {
    console.log('No BLOB_READ_WRITE_TOKEN found, returning empty blob list for testing');
    return { blobs: [] };
  }

  const cacheKey = JSON.stringify(options);
  const cached = blobCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const result = await list(options);
    blobCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    if (error.name === 'BlobServiceRateLimited') {
      // If we hit rate limits, return cached data if available, even if expired
      if (cached) {
        console.log('Using expired cache due to rate limit');
        return cached.data;
      }
      // Wait for the suggested retry time (but cap it at 10 seconds for tests)
      const retryAfter = Math.min(error.retryAfter || 5, 10);
      console.log(`Rate limited, retrying in ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return await list(options);
    }
    
    if (error.message && error.message.includes('No token found')) {
      console.log('Blob token missing, returning empty blob list for testing');
      return { blobs: [] };
    }
    
    throw error;
  }
}

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

// walkDirectoryRecursive function removed - no longer needed with blob storage

function isImageFile(pathname) {
  const ext = path.extname(pathname).toLowerCase();
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
        builtAt: new Date().toISOString()
      };
      fs.writeFileSync(BUILD_INFO_PATH, JSON.stringify(devInfo, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('Could not create dev build-info.json:', err.message);
  }
}

ensureDevBuildInfo();

// Log blob functionality status
if (HAS_BLOB_TOKEN) {
  console.log('🔵 Blob API: Enabled (token found)');
} else {
  console.log('⚪ Blob API: Disabled (no token - using fallback for testing)');
}

// Avatar redirect route for backward compatibility
// Redirects /avatars/* requests to the CDN URLs
app.get('/avatars/*', async (req, res) => {
  try {
    const avatarPath = req.params[0]; // Get everything after /avatars/
    const blobPath = `avatars/${avatarPath}`;
    
    // Find the blob with this exact path
    const { blobs } = await listBlobsWithCache({ 
      prefix: blobPath,
      limit: 1 
    });
    
    // Look for exact match
    const blob = blobs.find(b => b.pathname === blobPath);
    
    if (!blob) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Redirect to the CDN URL
    res.redirect(302, blob.url);
  } catch (err) {
    console.error('Avatar redirect error:', err);
    res.status(500).json({ error: 'Failed to serve avatar' });
  }
});

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

app.get('/api/campaigns/:id/images', async (req, res) => {
  try {
    const campaigns = loadCampaigns();
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get the campaign's folder path for blob filtering
    const campaignPath = campaign.icon_path || '';
    const blobPrefix = campaignPath ? `avatars/${campaignPath}/` : 'avatars/';

    // List blobs with the campaign prefix
    const { blobs } = await listBlobsWithCache({
      prefix: blobPrefix,
      limit: 1000, // Adjust as needed for your image collection size
    });

    // Filter for image files and format response
    const images = blobs
      .filter(blob => isImageFile(blob.pathname))
      .map(blob => ({
        src: blob.url, // Direct CDN URL
        fileName: blob.pathname.split('/').pop(), // Extract filename from path
        // Optional: keep backward compatibility info
        blobPath: blob.pathname,
        size: blob.size,
      }));

    res.json({ images });
  } catch (err) {
    console.error('Blob listing error:', err);
    res.status(500).json({ error: 'Failed to list images from CDN' });
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
        builtAt: data.builtAt || data.deployedAt || null // backward compatibility
      });
    }
    if (IS_DEV || !HAS_CLIENT_BUILD) {
      return res.json({ 
        repoUrl: null, 
        commitHash: 'DEV-LOCAL', 
        builtAt: new Date().toISOString()
      });
    }
    return res.json({ 
      repoUrl: null, 
      commitHash: null, 
      builtAt: null
    });
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
