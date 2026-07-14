import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // agent worktrees live under .claude/ and must not double-run the suite
    exclude: ['**/node_modules/**', '.claude/**'],
  },
});
