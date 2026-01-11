# Fringe Matrix Gallery

A digital archive for fan-created avatar images, built with React + TypeScript frontend and Express + TypeScript backend.

## Quick Start

### Prerequisites

- Node.js 22+
- NPM

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd fringematrix5

# Install dependencies (unified package.json)
npm install

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
fringematrix5/
├── client/          # React + TypeScript frontend (Vite)
│   ├── src/         # TypeScript source files
│   ├── test/        # Client-side tests
│   └── tsconfig.json # TypeScript configuration
├── server/          # Express + TypeScript backend
│   ├── server.ts    # Main server entry point
│   ├── test/        # Server-side tests
│   ├── tsconfig.json # TypeScript configuration
│   └── jest.config.js # Jest configuration
├── e2e/             # Playwright end-to-end tests
├── data/            # Campaign configuration (YAML)
├── avatars/         # Avatar images (served from Vercel Blob CDN)
├── assets/          # Migration scripts and utilities
├── scripts/         # Build utilities
└── deploy/          # Legacy deployment scripts (deprecated)
```

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the project root:

```env
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

### Optional Environment Variables

```env
# Loading Screen Selection (defaults to 'terminal')
# Options: 'legacy', 'terminal', 'glyphs'
VITE_LOADING_SCREEN=terminal
```

**Loading Screen Options:**
- `legacy` - Simple "Fringe Matrix 5 Loading..." message (original style)
- `terminal` - Terminal-style boot sequence with typing animation (default)
- `glyphs` - Fringe glyphs rotating on black background (minimalist)

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

## Available Commands

### Development Commands

```bash
# Start both client and server in development mode
npm run dev

# Start only the server (TypeScript)
npm run dev:server

# Start only the client (Vite dev server)
npm run dev:client

# Preview production build locally
npm run preview
```

### Build Commands

```bash
# Full production build (includes build info generation)
npm run build

# Build only the client
npm run build:client

# Generate build info only
npm run generate:build-info
```

### Testing Commands

#### Unit Tests
```bash
# Run all tests (server + client)
npm test

# Test server only
npm run test:server

# Test server in watch mode
npm run test:server:watch

# Test server for CI (with JUnit reporter)
npm run test:server:ci

# Test client only
npm run test:client

# Test client for CI
npm run test:client:ci
```

#### End-to-End Tests
```bash
# Install Playwright browsers (one-time setup)
npx playwright install --with-deps

# Run e2e tests
npm run test:e2e

# Run e2e tests with browser visible
npm run test:e2e:headed

# Run conservative e2e tests (reduced rate limiting)
npm run test:e2e:conservative

# View test report
npm run test:e2e:report
```

### Quality Assurance Commands

```bash
# TypeScript type checking (client only)
npm run typecheck

# Linting (currently not configured)
npm run lint
```

### Production Commands

```bash
# Start production server
npm start
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

### Frontend (React + TypeScript + Vite)
- Modern React with hooks and TypeScript
- Vite for fast development and building
- TypeScript for type safety
- CSS custom properties for theming
- Responsive grid layouts
- Vitest for unit testing

### Backend (Express + TypeScript)
- RESTful API for campaigns and images
- TypeScript for type safety and better development experience
- tsx for TypeScript execution in development
- Jest with ts-jest for unit testing
- Vercel Blob integration for CDN storage
- YAML-based campaign configuration
- Development/production environment handling

### Build System
- Automatic build-info.json generation
- Environment-aware builds (dev vs production)
- Git commit tracking for deployments
- TypeScript compilation and type checking
- Unified package.json for monorepo-style development

## Development

### Adding New Campaigns

1. Edit `data/campaigns.yaml`
2. Add campaign configuration with icon path
3. Upload images to corresponding Blob storage path
4. Restart server to pick up changes

### Build Information

The app automatically generates build metadata in `build-info.json`:
- **Local development**: `commitHash: "dev-local"`
- **CI/Production**: `commitHash: "<actual-git-hash>"`

This file is generated during `npm run build` and includes:
- Repository URL
- Build timestamp (`builtAt`)
- Commit hash (environment-dependent)

## Troubleshooting

### Common Issues

1. **Missing images**: Check `BLOB_READ_WRITE_TOKEN` configuration
2. **E2E test failures**: See `e2e/README.md` for rate limiting solutions  
3. **Build failures**: Ensure Node.js 22+ and clean `npm install`
4. **TypeScript errors**: Run `npm run typecheck` to check for type issues

### Logs

Check server logs for:
- `🔵 Blob API: Enabled` - CDN working
- `⚪ Blob API: Disabled` - Using fallback mode
- Rate limiting warnings from Vercel Blob

---

## TypeScript Configuration

### Server TypeScript Setup
- `server/tsconfig.json` - Server TypeScript configuration
- Uses `tsx` for development execution
- Jest with `ts-jest` for testing TypeScript files
- Strict type checking enabled

### Client TypeScript Setup
- `client/tsconfig.json` - Client TypeScript configuration
- Vite handles TypeScript compilation
- Vitest for testing TypeScript components
- React JSX support

### Development Notes
- Both client and server use TypeScript with strict mode
- Type definitions included for all major dependencies
- Import/export syntax is ES modules throughout
- Full type safety for API contracts and data structures

## Documentation

- `e2e/README.md` - Detailed testing documentation
- `server/test/api.contract.md` - API endpoint specifications
- `VERCEL_DEPLOYMENT.md` - Deployment migration history  
- `VERCEL_BUILD_DEBUG.md` - Troubleshooting build-info.json in Vercel deployments