import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import build from '@hono/vite-build/cloudflare-workers';
import devServer from '@hono/vite-dev-server';
import adapter from '@hono/vite-dev-server/cloudflare';
import path from 'node:path';

const APP_BASE_PATH = '/apps/todo';

export default defineConfig(({ mode }) => {
  // Client (SPA) build — outputs to dist/client<APP_BASE_PATH>/ so the URL
  // prefix matches the on-disk path served by the ASSETS binding.
  if (mode === 'client') {
    return {
      root: path.resolve(__dirname, 'src/client'),
      base: `${APP_BASE_PATH}/`,
      plugins: [tailwindcss(), react()],
      build: {
        outDir: path.resolve(__dirname, `dist/client${APP_BASE_PATH}`),
        emptyOutDir: true,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    };
  }

  // Server (Hono on Workers) build — outputs to dist/server
  return {
    plugins: [
      build({
        entry: 'src/server/index.ts',
        outputDir: 'dist/server',
      }),
      devServer({
        adapter,
        entry: 'src/server/index.ts',
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
