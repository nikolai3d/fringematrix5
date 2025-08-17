import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Get branch name from environment variable for build-time base path
  const branchName = process.env.BRANCH_NAME || 'main';
  const base = `/${branchName}/`;

  return {
    plugins: [react()],
    base: command === 'build' ? base : '/', // Use branch base for builds, root for dev
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
    },
    test: {
      environment: 'node',
      include: ['test/**/*.test.{js,jsx,ts,tsx}'],
    },
  };
});


