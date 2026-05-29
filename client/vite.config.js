import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@modyfi/vite-plugin-yaml';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    yaml(),
    VitePWA({
      // Auto-update: a new service worker installs and activates on the next
      // visit/navigation without prompting. Combined with skipWaiting +
      // clientsClaim below, this prevents users from being stranded on stale
      // precached assets after a deploy.
      registerType: 'autoUpdate',
      // Register the SW from bundled app JS (see main.tsx) instead of letting
      // the plugin inject an inline <script> into index.html. Our production
      // CSP is `script-src 'self'` with no 'unsafe-inline', so an injected
      // inline registration snippet would be blocked. A bundled, same-origin
      // registration is fully covered by `script-src 'self'`.
      injectRegister: null,
      // Disable the SW in `vite dev` so HMR and the dev proxy are unaffected.
      // The SW is only generated for production builds (npm run build).
      devOptions: {
        enabled: false,
      },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      manifest: {
        name: 'Fringe Matrix Gallery',
        short_name: 'Fringe Matrix',
        description: 'A digital archive for fan-created Fringe avatar images.',
        theme_color: '#06090f',
        background_color: '#06090f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache hashed build assets (cache-first / immutable). Workbox
        // handles cache-busting via per-file revision hashes baked into the
        // generated sw.js, so a deploy replaces the precache automatically.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Ensure the new SW takes over immediately on update (pairs with
        // registerType: 'autoUpdate').
        skipWaiting: true,
        clientsClaim: true,
        // Don't intercept SPA navigations for API/avatar routes; let them hit
        // the network/server so redirects and JSON responses are unaffected.
        navigateFallbackDenylist: [/^\/api\//, /^\/avatars\//],
        runtimeCaching: [
          {
            // Campaigns list + per-campaign images + authors. Mirrors the
            // server's HTTP policy (max-age=3600, stale-while-revalidate).
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith('/api/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fm-api',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Vercel Blob CDN images (thumbnails + full images). Cache-first
            // with an LRU/size cap so offline browsing of recently-viewed
            // images works without unbounded storage growth.
            urlPattern: ({ url }) => /\.public\.blob\.vercel-storage\.com$/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fm-blob-images',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts stylesheet + font files (loaded from index.html).
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fm-fonts',
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/avatars': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'glyph-spinner-debug': resolve(__dirname, 'glyph-spinner-debug.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{js,jsx,ts,tsx}'],
    globals: true,
    setupFiles: ['./test/setup.js'],
  },
});
