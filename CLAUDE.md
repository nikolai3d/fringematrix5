# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fringe Matrix Gallery is a full-stack React + Express application for fan-created avatar images. It uses Vercel Blob for CDN image storage and organizes images by campaigns (TV episodes).

## Commands

### Development
```bash
npm install          # Install dependencies (requires Node 22+)
npm run dev          # Start client (port 5173) + server (port 3000) concurrently
npm run dev:server   # Server only (TypeScript via tsx)
npm run dev:client   # Client dev server only
```

### Build
```bash
npm run build        # Full production build (generates build-info + client build)
npm start            # Start production server
```

### Testing
```bash
npm test                     # Run all tests (server + client)
npm run test:server          # Server tests (Jest + ts-jest)
npm run test:server:watch    # Server tests in watch mode
npm run test:client          # Client tests (Vitest)
npm run test:e2e             # E2E tests (Playwright, 2 workers)
npm run test:e2e:headed      # E2E with visible browser
npm run test:e2e:conservative # E2E with 1 worker (rate-limit safe)
```

**Note on jsdom version:**
- Using jsdom v24.1.0 (not latest v27+) due to ESM compatibility issues with Vitest
- v25+ introduced breaking changes in ESM module resolution that cause import failures in client tests
- v24.1.0 is the last stable version with full ESM compatibility in this project's configuration

Run a single test file:
```bash
npx playwright test app.spec.ts           # Single e2e test file
npx playwright test -g "Build Info"       # By test name
npm run test:server -- --testPathPattern=api.test.ts  # Single server test
```

### Type Checking
```bash
npm run typecheck    # TypeScript check (client only)
```

## Architecture

```
client/               # React + TypeScript frontend (Vite)
  src/
    App.tsx          # Main component with full app state
    hooks/           # Custom hooks (useLightboxAnimations)
    utils/           # Utility functions
    types/api.ts     # API contract types
  test/              # Vitest unit tests

server/               # Express + TypeScript backend
  server.ts          # Main entry point (~700 lines, handles all routes)
  test/              # Jest/Supertest API tests

e2e/                  # Playwright tests
  playwright.config.ts  # Main config

data/
  campaigns.yaml     # Campaign definitions (hashtag, dates, links)
```

## API Endpoints

- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id/images` - Images for a campaign (from Vercel Blob)
- `GET /api/build-info` - Deployment metadata
- `GET /avatars/*` - Redirects to Vercel Blob CDN

## Key Implementation Details

**Client-Server Flow:**
1. Client fetches `/api/campaigns` on mount
2. Selects campaign from URL hash or first available
3. Fetches `/api/campaigns/{id}/images`
4. Preloads all images in parallel, then renders

**Vercel Blob Integration:**
- Server caches blob listings (30s TTL) to reduce API calls
- Implements retry with exponential backoff for rate limits
- Falls back to empty lists if `BLOB_READ_WRITE_TOKEN` is missing

**Environment Variables:**
- `BLOB_READ_WRITE_TOKEN` - Required for production, optional for development

**Client Configuration:**
- Centralized configuration in `client/config.yaml`
- Edit this file to customize app behavior without modifying code
- Configuration is loaded at build time via vite-plugin-yaml

**Loading Screens:**
- Three loading screen options configurable in `client/config.yaml`:
  - `legacy` - Simple "Fringe Matrix 5 Loading..." message (original style)
    - User can skip by pressing Enter/Space/click when data is ready
  - `terminal` - Terminal-style boot sequence with typing animation
    - User can skip by pressing Enter/Space/click when data is ready
  - `glyphs` - Fringe glyphs rotating on black background (default)
    - Auto-fades only (no manual skip) for a cleaner, uninterrupted visual experience
- Configuration settings in `client/config.yaml`:
  - `loadingScreen.type` - Which loading screen to display
  - `loadingScreen.autoFadeDelayMs` - Delay before auto-fading to main content (default: 300ms, valid range: 0-10000ms)
- Individual components in `client/src/components/` (LegacyLoadingScreen, TerminalLoadingScreen, GlyphsLoadingScreen)

**Lightbox Sidebar Animation:**
- The zoomed-in image view's IMAGE DETAILS sidebar uses a custom enter/exit animation: it expands from a thin blinking horizontal line into the full panel on open, and collapses back to a line on close.
- Timings live in `client/config.yaml` under `lightbox.sidebarAnimation` (`enterDurationMs`, `exitDurationMs`, `lineHoldMs`, `lineBlinkCount`, `lineBlinkIntervalMs`, `contentFadeInDelayMs`). Out-of-range or invalid values fall back to defaults with a `console.warn`; see `client/src/config/lightbox.ts`.
- In reduce-effects mode (in-app toggle or `prefers-reduced-motion`), the timings are ignored and the sidebar appears/disappears instantly.

**Build Info:**
- Generated by `scripts/generate-build-info.js`
- `commitHash: "dev-local"` in development
- Actual git hash in CI/production


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
