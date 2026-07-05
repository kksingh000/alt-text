/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Bundle the scorer straight from source; no prebuilt dist needed.
      '@alt-text/scorer': fileURLToPath(new URL('../packages/scorer/ts/src/index.ts', import.meta.url)),
    },
  },
  server: {
    // Local dev against a locally-running backend (uvicorn app.main:app).
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
