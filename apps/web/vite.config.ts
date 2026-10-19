import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root: resolve(import.meta.dirname),
  esbuild: { jsx: 'automatic' },
  build: { outDir: resolve(import.meta.dirname, '../../dist/web'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:3000', '/healthz': 'http://127.0.0.1:3000' } }
});
