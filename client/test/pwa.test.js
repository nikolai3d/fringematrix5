/**
 * Tests for the PWA / service worker setup (vite-plugin-pwa, bead kwz9).
 *
 * The core contract tests import the PWA option objects directly from
 * `../pwa-config.js` (the source of truth that vite.config.js feeds to
 * VitePWA). This lets them run in plain `vitest run` WITHOUT a build, so the
 * substantive manifest/workbox assertions execute in CI's client-tests job:
 *  - The web manifest has the required fields + icons.
 *  - The PWA options wire up autoUpdate / injectRegister / devOptions.
 *  - The workbox config wires up the expected runtime caches
 *    (api / blob images / fonts) with the strategies that mirror the
 *    server's HTTP cache policy, plus skipWaiting/clientsClaim and the
 *    navigate-fallback denylist.
 *  - vercel.json CSP allows a same-origin service worker + manifest and does
 *    NOT weaken script-src (no 'unsafe-inline'/'unsafe-eval').
 *  - SW registration in main.tsx is guarded by a feature check.
 *
 * A bonus group inspects the generated dist/* artifacts when present, but it
 * is skipped (not the only coverage) when the build hasn't run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { pwaOptions, pwaManifest, pwaWorkbox } from '../pwa-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, '..');
const repoRoot = resolve(clientDir, '..');
const distDir = resolve(clientDir, 'dist');

const manifestPath = resolve(distDir, 'manifest.webmanifest');
const swPath = resolve(distDir, 'sw.js');
const hasBuild = existsSync(manifestPath) && existsSync(swPath);

const describeIfBuilt = hasBuild ? describe : describe.skip;

describe('PWA web manifest (pwa-config.js)', () => {
  it('declares the app name and short_name', () => {
    expect(pwaManifest.name).toBe('Fringe Matrix Gallery');
    expect(pwaManifest.short_name).toBe('Fringe Matrix');
  });

  it('uses the dark theme/background color', () => {
    expect(pwaManifest.theme_color).toBe('#06090f');
    expect(pwaManifest.background_color).toBe('#06090f');
  });

  it('ships at least a 192px and a 512px icon plus a maskable icon', () => {
    const sizes = pwaManifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(pwaManifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('PWA plugin options (pwa-config.js)', () => {
  it('auto-updates the service worker', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate');
  });

  it('does not inject an inline registration script (CSP-safe)', () => {
    expect(pwaOptions.injectRegister).toBe(null);
  });

  it('disables the service worker in dev', () => {
    expect(pwaOptions.devOptions.enabled).toBe(false);
  });
});

describe('Workbox runtime caching (pwa-config.js)', () => {
  const runtimeCaching = pwaWorkbox.runtimeCaching;
  const byCache = (name) => runtimeCaching.find((r) => r.options.cacheName === name);

  it('takes over immediately on update', () => {
    expect(pwaWorkbox.skipWaiting).toBe(true);
    expect(pwaWorkbox.clientsClaim).toBe(true);
  });

  it('excludes API and avatar routes from the navigate fallback', () => {
    const denylist = pwaWorkbox.navigateFallbackDenylist;
    expect(denylist.some((re) => re.test('/api/x'))).toBe(true);
    expect(denylist.some((re) => re.test('/avatars/x'))).toBe(true);
  });

  it('caches the API with stale-while-revalidate', () => {
    const api = byCache('fm-api');
    expect(api).toBeTruthy();
    expect(api.handler).toBe('StaleWhileRevalidate');
  });

  it('caches Blob CDN images with cache-first', () => {
    const blob = byCache('fm-blob-images');
    expect(blob).toBeTruthy();
    expect(blob.handler).toBe('CacheFirst');
  });

  it('caches fonts with stale-while-revalidate', () => {
    const fonts = byCache('fm-fonts');
    expect(fonts).toBeTruthy();
    expect(fonts.handler).toBe('StaleWhileRevalidate');
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

// Bonus: when the production build has run, sanity-check the emitted
// artifacts too. Skipped (not the only coverage) when dist/* is absent.
describeIfBuilt('PWA build artifacts (dist/)', () => {
  const manifest = hasBuild ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const sw = hasBuild ? readFileSync(swPath, 'utf8') : '';

  it('emits a manifest with the expected name', () => {
    expect(manifest.name).toBe('Fringe Matrix Gallery');
    expect(manifest.short_name).toBe('Fringe Matrix');
  });

  it('emits a service worker with the runtime caches and precache', () => {
    expect(sw).toContain('fm-api');
    expect(sw).toContain('fm-blob-images');
    expect(sw).toContain('fm-fonts');
    expect(sw).toContain('precacheAndRoute');
  });
});
