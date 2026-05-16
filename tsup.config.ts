import { defineConfig } from 'tsup'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

const scriptsDir = './scripts'

const entries = readdirSync(scriptsDir).filter(name =>
  name.endsWith('.ts') && statSync(join(scriptsDir, name)).isFile()
)

export default defineConfig({
  entry: Object.fromEntries(
    entries.map(name => {
      const key = name.replace(/\.ts$/, '')
      return [`${key}/index`, `${scriptsDir}/${name}`]
    })
  ),
  outDir: 'dist',
  format: ['cjs'],
  target: 'node20',
  bundle: true,
  minify: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  esbuildOptions(options) {
    options.alias = {
      '@gh-ai-workflows/core': './packages/core/src/index.ts',
      '@gh-ai-workflows/github': './packages/github/src/index.ts',
      '@gh-ai-workflows/providers': './packages/providers/src/index.ts',
      '@gh-ai-workflows/validators': './packages/validators/src/index.ts',
    }
  },
})
