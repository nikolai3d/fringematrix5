/**
 * Tests for the PWA / service worker setup (vite-plugin-pwa, bead kwz9).
 *
 * These are build-artifact + config contract tests:
 *  - The generated web manifest has the required fields + icons.
 *  - The generated service worker wires up the expected runtime caches
 *    (api / blob images / fonts) with the strategies that mirror the
 *    server's HTTP cache policy.
 *  - vercel.json CSP allows a same-origin service worker + manifest and does
 *    NOT weaken script-src (no 'unsafe-inline'/'unsafe-eval').
 *  - SW registration in main.tsx is guarded by a feature check.
 *
 * The dist/* artifacts only exist after `npm run build`. When they are
 * absent (e.g. a bare `vitest run` without a prior build) the artifact
 * checks are skipped so the suite stays green in either order; CI always
 * builds before running e2e, and the build itself fails loudly if the SW
 * is misconfigured.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, '..');
const repoRoot = resolve(clientDir, '..');
const distDir = resolve(clientDir, 'dist');

const manifestPath = resolve(distDir, 'manifest.webmanifest');
const swPath = resolve(distDir, 'sw.js');
const hasBuild = existsSync(manifestPath) && existsSync(swPath);

const describeIfBuilt = hasBuild ? describe : describe.skip;

describeIfBuilt('PWA web manifest (dist/manifest.webmanifest)', () => {
  const manifest = hasBuild ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

  it('declares the app name and short_name', () => {
    expect(manifest.name).toBe('Fringe Matrix Gallery');
    expect(manifest.short_name).toBe('Fringe Matrix');
  });

  it('uses the dark theme/background color', () => {
    expect(manifest.theme_color).toBe('#06090f');
    expect(manifest.background_color).toBe('#06090f');
  });

  it('ships at least a 192px and a 512px icon plus a maskable icon', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

describeIfBuilt('Service worker runtime caching (dist/sw.js)', () => {
  const sw = hasBuild ? readFileSync(swPath, 'utf8') : '';

  it('registers the API stale-while-revalidate cache', () => {
    expect(sw).toContain('fm-api');
    expect(sw).toContain('StaleWhileRevalidate');
  });

  it('registers the Blob CDN cache-first image cache', () => {
    expect(sw).toContain('fm-blob-images');
    expect(sw).toContain('CacheFirst');
  });

  it('registers the fonts cache', () => {
    expect(sw).toContain('fm-fonts');
  });

  it('precaches build assets', () => {
    expect(sw).toContain('precacheAndRoute');
  });
});

describe('vercel.json CSP is PWA-compatible', () => {
  const vercel = JSON.parse(readFileSync(resolve(repoRoot, 'vercel.json'), 'utf8'));
  const csp = vercel.headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === 'Content-Security-Policy').value;

  it('keeps script-src self-only (no unsafe-inline / unsafe-eval)', () => {
    const scriptSrc = csp.match(/script-src ([^;]+)/)[1].trim();
    expect(scriptSrc).toBe("'self'");
  });

  it('allows a same-origin service worker (worker-src or default-src self)', () => {
    const allowed =
      /worker-src [^;]*'self'/.test(csp) ||
      (!/worker-src/.test(csp) && /default-src [^;]*'self'/.test(csp));
    expect(allowed).toBe(true);
  });

  it('allows the web manifest (manifest-src or default-src self)', () => {
    const allowed =
      /manifest-src [^;]*'self'/.test(csp) ||
      (!/manifest-src/.test(csp) && /default-src [^;]*'self'/.test(csp));
    expect(allowed).toBe(true);
  });
});

describe('Service worker registration (src/main.tsx)', () => {
  const main = readFileSync(resolve(clientDir, 'src', 'main.tsx'), 'utf8');

  it('is guarded by a serviceWorker feature check', () => {
    expect(main).toContain("'serviceWorker' in navigator");
  });

  it('uses the vite-plugin-pwa virtual register module', () => {
    expect(main).toContain('virtual:pwa-register');
  });
});
