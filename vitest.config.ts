import { defineConfig } from 'vitest/config';

// Runs the pure-logic spec in tests/. (tests/smoke.test.cjs is a node:test file and is run with `node --test`.)
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
  },
});
