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

   Note: In development the React app is served by Vite on port 5173. No `client/dist` is created during dev; that folder only exists after a production build.

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

   This generates the `client/dist/` directory (it is not checked into git).

2. Start server (serves `client/dist` if present):
   
   ```bash
   npm start
   ```

3. Open the app:
   - Visit `http://localhost:3000`

   Notes:
   - For production usage, run the build step first so `client/dist` exists. The Express server will then serve the built SPA from that folder.
   - If `client/dist` is missing, the server falls back to serving static files from `public/`. In that case, the React app itself will not be available unless you build it.

### Project structure
- `server.js`: Express server, API endpoints, static hosting
- `client/`: React app (Vite)
- `data/campaigns.yaml`: Campaign list and metadata
- `avatars/`: Image roots (ignored by git by default)

### Notes
- Campaign IDs are generated from their `hashtag` (slugified); navigation uses these.
- If you add or rename campaigns, restart the server to pick up changes.
