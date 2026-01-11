## API Contract

This document specifies the expected behavior of each HTTP API endpoint exposed by the backend. All responses are JSON unless noted.

Base URL: `http://localhost:3000`

### GET `/api/campaigns`
- Description: List all campaigns defined in `data/campaigns.yaml` with generated `id`.
- Success 200 response:
  - Body: `{ campaigns: Array<Campaign> }`
  - `Campaign` shape:
    - `id`: string (slugified from `hashtag` or `icon_path`)
    - Other fields are passed through from YAML (e.g., `hashtag`, `title`, `icon_path`, etc.)
- Error 500:
  - Body: `{ error: "Failed to load campaigns" }`

### GET `/api/campaigns/:id/images`
- Description: Recursively list image files for the specified campaign under `avatars/` (optionally under `icon_path`).
- Success 200 response:
  - Body: `{ images: Array<{ src: string; fileName: string }> }`
  - `src`: public URL path starting with `/avatars/`
  - `fileName`: basename of the file
- Not found 404:
  - Body: `{ error: "Campaign not found" }`
- Error 500:
  - Body: `{ error: "Failed to list images" }`

### GET `/api/build-info`
- Description: Returns build metadata from `build-info.json` if present; otherwise returns dev-local defaults when in development or when client build is absent.
- Success 200 response:
  - Body: `{ repoUrl: string|null, commitHash: string|null, deployedAt: string|null }`
  - When `build-info.json` exists and is valid JSON: fields reflect file contents (missing fields become `null`).
  - When missing and in dev or without `client/dist`: `{ repoUrl: null, commitHash: "DEV-LOCAL", deployedAt: <ISO timestamp> }`
  - When missing and in prod with `client/dist`: `{ repoUrl: null, commitHash: null, deployedAt: null }`
- Error 500:
  - Body: `{ error: "Failed to load build info" }`

### GET `/api/glyphs`
- Description: Returns list of glyph image URLs from `avatars/_images/Glyphs/small/` for use in the loading spinner component.
- Success 200 response:
  - Body: `{ glyphs: Array<string> }`
  - Each string is a CDN URL pointing to a glyph image
  - Only image files are included (extensions: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.svg`)
  - Returns empty array if no blob token is configured or no images exist
- Error 500:
  - Body: `{ error: "Failed to list glyphs" }`

### Fallback `/api/*`
- Any other `/api/*` path responds with 404 JSON: `{ error: "Not found" }`


