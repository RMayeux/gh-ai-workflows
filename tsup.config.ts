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
  // No more aliases needed since we're using relative paths or TS paths in the code
})
