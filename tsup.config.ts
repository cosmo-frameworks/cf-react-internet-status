import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  external: ['react'],
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
  // esbuild strips top-of-file directives. The whole package is client-only
  // (hooks + DOM listeners), so a bundle-level 'use client' is correct here,
  // not a workaround — it lets Next.js App Router consumers import it directly.
  banner: { js: "'use client';" },
});
