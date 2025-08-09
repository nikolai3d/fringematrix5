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
