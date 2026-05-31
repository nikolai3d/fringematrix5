import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@modyfi/vite-plugin-yaml';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { pwaOptions } from './pwa-config.js';

export default defineConfig({
  plugins: [
    react(),
    yaml(),
    VitePWA(pwaOptions),
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
