# Fringe Matrix Gallery

A digital archive for fan-created avatar images, built with React frontend and Express backend.

## Quick Start

### Prerequisites

- Node.js 18+
- NPM

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd fringematrix

# Install dependencies
npm --prefix server install
npm --prefix client install
npm --prefix e2e install

# Start development servers
npm run dev
```

This starts:
- Backend server on `http://localhost:3000`
- Frontend dev server (proxied through backend)

### Production Build

```bash
# Build client
npm run build

# Start production server
npm start
```

## Project Structure

```
fringematrix/
├── client/          # React frontend (Vite)
├── server/          # Express backend
├── e2e/             # Playwright end-to-end tests
├── data/            # Campaign configuration (YAML)
├── avatars/         # Avatar images (served from Vercel Blob CDN)
├── scripts/         # Build utilities
└── deploy/          # Legacy deployment scripts (deprecated)
```

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the project root:

```env
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

### For CI/CD (GitHub Actions)

**Required Repository Secret:**

1. Go to: Repository → Settings → Secrets and variables → Actions  
2. Click "New repository secret"
3. Name: `BLOB_READ_WRITE_TOKEN`
4. Value: Your Vercel Blob token

**Fallback Behavior:**
- If no token is provided, the server automatically falls back to empty image lists
- Tests will still run successfully but without real avatar images
- Server logs will show: `⚪ Blob API: Disabled (no token - using fallback for testing)`

## Testing

### Unit Tests

```bash
# Test server
npm run test:server

# Test client  
npm run test:client

# Test all
npm test
```

### End-to-End Tests

```bash
# Install Playwright browsers (one-time)
npx --prefix e2e playwright install --with-deps

# Run e2e tests
npm run e2e

# Run with browser visible
npm --prefix e2e run e2e:headed

# View test report
npm --prefix e2e run e2e:report
```

**Note**: E2E tests require `BLOB_READ_WRITE_TOKEN` for full functionality. Without it, tests run with empty image data (fallback mode).

See `e2e/README.md` for detailed testing documentation.

## Features

- **Campaign-based Gallery**: Organize avatar images by campaigns/themes
- **CDN Integration**: Images served from Vercel Blob storage
- **Responsive Design**: Works on desktop and mobile
- **Lightbox Navigation**: Click through images with keyboard/mouse
- **Build Information**: Shows deployment details and commit info

## API Endpoints

- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id/images` - Get images for a campaign
- `GET /api/build-info` - Get build/deployment information
- `GET /avatars/*` - Proxy to CDN images

## Deployment

### Vercel (Recommended)

The project is configured for automatic Vercel deployment:

1. Connect repository to Vercel
2. Add `BLOB_READ_WRITE_TOKEN` to Vercel environment variables
3. Deploy automatically on push to main branch

**Build Info**: Vercel should automatically provide Git commit information. If build info shows "dev-local" in deployment, see `VERCEL_BUILD_DEBUG.md` for troubleshooting.

### Manual Deployment

See `VERCEL_DEPLOYMENT.md` for migration notes from legacy deployment.

## Architecture

### Frontend (React + Vite)
- Modern React with hooks
- Vite for fast development and building
- CSS custom properties for theming
- Responsive grid layouts

### Backend (Express)
- RESTful API for campaigns and images
- Vercel Blob integration for CDN storage
- YAML-based campaign configuration
- Development/production environment handling

### Build System
- Automatic build-info.json generation
- Environment-aware builds (dev vs production)
- Git commit tracking for deployments

## Development

### Adding New Campaigns

1. Edit `data/campaigns.yaml`
2. Add campaign configuration with icon path
3. Upload images to corresponding Blob storage path
4. Restart server to pick up changes

### Build Information

The app automatically generates build metadata in `build-info.json`:
- **Local development**: `commitHash: "dev-local"`, `committedAt: "N/A"`
- **CI/Production**: `commitHash: "<actual-git-hash>"`, `committedAt: "<commit-timestamp>"`

This file is generated during `npm run build` and includes:
- Repository URL
- Build timestamp (`builtAt`)
- Commit hash and timestamp (environment-dependent)

## Troubleshooting

### Common Issues

1. **Missing images**: Check `BLOB_READ_WRITE_TOKEN` configuration
2. **E2E test failures**: See `e2e/README.md` for rate limiting solutions  
3. **Build failures**: Ensure Node.js 18+ and clean `npm install`

### Logs

Check server logs for:
- `🔵 Blob API: Enabled` - CDN working
- `⚪ Blob API: Disabled` - Using fallback mode
- Rate limiting warnings from Vercel Blob

---

## Documentation

- `e2e/README.md` - Detailed testing documentation
- `VERCEL_DEPLOYMENT.md` - Deployment migration history  
- `VERCEL_BUILD_DEBUG.md` - Troubleshooting build-info.json in Vercel deployments