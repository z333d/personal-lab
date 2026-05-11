import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(() => ({
  plugins: [tailwindcss(), react()],
  // build-lab.mjs sets LAB_APP_BASE for path-prefixed deployment;
  // dev server uses '/' so vite serves at the root.
  base: process.env.LAB_APP_BASE || '/',
  build: {
    outDir: process.env.LAB_APP_OUT_DIR || path.resolve(__dirname, '../../dist/client/apps/counter'),
    emptyOutDir: true,
  },
}));
