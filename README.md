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
npm --prefix client run build
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

- Bash (Linux/macOS/WSL):

```bash
bash deploy/deploy.sh -HostName <HOST> -User <USER> -RemoteDir /var/www/fringematrix -AppName fringematrix
```

- PowerShell (Windows):

```powershell
pwsh -File .\deploy\deploy.ps1 -HostName <HOST> -User deploy -RemoteDir /var/www/fringematrix -AppName fringematrix
```

These scripts:
- Build the client (`client/dist`)
- Package runtime pieces: `server/`, `data/`, optional `avatars/`, and built client
- Upload to the server via SSH/SCP
- Install production deps for the backend and start/reload via PM2

For first-time server setup and optional HTTPS, see `deploy/server-setup.sh` and `deploy/README.md`.
