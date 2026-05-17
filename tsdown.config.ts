import { defineConfig } from 'tsdown'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

const scriptsDir = './scripts'

const entries = readdirSync(scriptsDir)
  .filter(name => name.endsWith('.ts') && statSync(join(scriptsDir, name)).isFile())
  .map(name => `${scriptsDir}/${name}`)

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