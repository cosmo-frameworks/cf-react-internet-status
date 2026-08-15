import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/**/*.test.{ts,tsx}'],
          exclude: ['test/**/*.ssr.test.{ts,tsx}'],
          setupFiles: ['test/setup.ts'],
          globals: true,
          restoreMocks: true,
        },
      },
      {
        // SSR behaviour is only meaningfully tested in a real Node environment,
        // without jsdom's window/document/navigator globals.
        test: {
          name: 'ssr',
          environment: 'node',
          include: ['test/**/*.ssr.test.{ts,tsx}'],
          globals: true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: { lines: 85, functions: 85, branches: 75 },
    },
  },
});
