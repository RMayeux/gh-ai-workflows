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
      return [key, `${scriptsDir}/${name}`]
    })
  ),
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  bundle: true,
  minify: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  esbuildOptions(options) {
    options.mainFields = ['module', 'main']
    options.conditions = ['import', 'default']
  },
})