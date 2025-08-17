## Fringe Matrix Gallery (2025 Edition)

A futuristic single‑page web app to browse image galleries for Fringe Twitter campaigns.

### Setup
- Prerequisites: Node.js 18+ and npm
- Install dependencies:

```bash
npm --prefix server install
npm --prefix client install
```

Note: The root `package.json` is a placeholder to work around Windows npm behavior.

### Build and Run (dev)
1) Start the backend (API at 3000):

```bash
npm --prefix server start
```

2) Start the frontend dev server (Vite at 5173):

```bash
npm --prefix client run dev
```

3) Open the app at `http://localhost:5173`.

Notes:
- In development the React app is served by Vite on port 5173. No `client/dist` is created during dev; that folder only exists after a production build.

### Production Build

For local testing or production builds, you must specify a branch name to set the correct base path:

```bash
# For local development/testing
BRANCH_NAME=local-dev npm --prefix client run build

# For production deployment (examples)
BRANCH_NAME=main npm --prefix client run build
BRANCH_NAME=test-branch npm --prefix client run build
```

The branch name determines the base path for assets:
- `BRANCH_NAME=local-dev` → assets served from `/local-dev/assets/`
- `BRANCH_NAME=main` → assets served from `/main/assets/`
- `BRANCH_NAME=feature-xyz` → assets served from `/feature-xyz/assets/`

### Test
Server (backend):

- Stack: Jest + Supertest
- Location: `server/test/`

```bash
# Install (once)
npm --prefix server install

# Run locally
npm --prefix server test

# CI / single run with JUnit
npm --prefix server run test:ci
```

Client (frontend):

- Stack: Vitest
- Location: `client/test/`

```bash
# Install (once)
npm --prefix client install

# Watch mode
npm --prefix client run test

# CI / single run
npm --prefix client run test:ci
```

### End-to-End (UI) with Playwright

- What is Playwright: a modern E2E testing framework that drives real browsers to validate user flows.
- Location: `e2e/` directory (contains tests and Playwright config).
- Runs the built SPA served by the Express backend (`server/server.js`).

```bash
# One-time: install dependencies (server, client, e2e) and browsers
npm --prefix server install
npm --prefix client install
npm --prefix e2e install
npx --prefix e2e playwright install --with-deps

# Build client and run E2E locally (headless)
BRANCH_NAME=local-dev npm --prefix client run build
npm --prefix e2e run e2e

# Headed/debug
npm --prefix e2e run e2e:headed
npm --prefix e2e run e2e:report
```

Notes:
- The Playwright config in `e2e/playwright.config.ts` builds the client and starts the backend automatically via `webServer`.
- Ensure port 3000 is free.
- If you change API data in `data/`, re-run the tests to pick up changes.

### Deploy
Use the provided scripts to build locally and deploy to a remote Linux server (e.g., DigitalOcean). See `deploy/README.md` for full details.

Each deployment creates a branch-specific directory and runs on its own port:

- Bash (Linux/macOS/WSL):

```bash
# Deploy main branch
bash deploy/deploy.sh -HostName <HOST> -User <USER> -Version main

# Deploy feature branch
bash deploy/deploy.sh -HostName <HOST> -User <USER> -Version feature-xyz
```

- PowerShell (Windows):

```powershell
# Deploy main branch  
pwsh -File .\deploy\deploy.ps1 -HostName <HOST> -User deploy -Version main

# Deploy feature branch
pwsh -File .\deploy\deploy.ps1 -HostName <HOST> -User deploy -Version feature-xyz
```

These scripts:
- Build the client with branch-specific base paths (`BRANCH_NAME=<Version>`)
- Package runtime pieces: `server/`, `data/`, optional `avatars/`, and built client
- Deploy to `/var/www/fringematrix/<Version>/` on the server
- Install production deps for the backend and start/reload via PM2
- Main branch runs on port 3000, other branches get calculated ports (3001-3100)

Access your deployments at:
- Main: `https://yoursite.com/main/`
- Branches: `https://yoursite.com/<branch-name>/`

For first-time server setup and optional HTTPS, see `deploy/server-setup.sh` and `deploy/README.md`.
