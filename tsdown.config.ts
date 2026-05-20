import { defineConfig } from 'tsdown'

const entries = 'features/*/index.ts'

export default defineConfig({
  entry: entries,
  outDir: 'dist',
  format: 'esm',
  target: 'node20',
  platform: 'node',
  minify: true,
  clean: true,
  dts: false,
  noExternal: [/.*/],  // inline everything — required for self-contained Actions
})