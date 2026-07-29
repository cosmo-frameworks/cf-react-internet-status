import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // NOT enabling `treeshake`: it runs the output back through rollup, which
  // strips module-level directives and silently drops the 'use client' banner
  // below. Consumer bundlers tree-shake this anyway, and `sideEffects: false`
  // is declared in package.json.
  target: 'es2020',
  external: ['react'],
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
  // esbuild strips top-of-file directives. The whole package is client-only
  // (hooks + DOM listeners), so a bundle-level 'use client' is correct here,
  // not a workaround — it lets Next.js App Router consumers import it directly.
  banner: { js: "'use client';" },
});
