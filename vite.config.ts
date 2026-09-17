import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // The Android WebView loads this from disk; a single bundle is simplest.
    assetsInlineLimit: 4096,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
