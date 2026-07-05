import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests cover the pure, RN-free logic (money / date / selectors / merge).
// Vitest uses esbuild (not babel), so nativewind/babel doesn't interfere.
const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(dir, 'src'),
    },
  },
});
