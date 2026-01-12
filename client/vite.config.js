import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@modyfi/vite-plugin-yaml';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), yaml()],
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


