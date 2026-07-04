import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@alt-text/scorer': fileURLToPath(
        new URL('../packages/scorer/ts/src/index.ts', import.meta.url),
      ),
    },
  },
});
