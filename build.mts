import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const scriptsDir = './scripts'

readdirSync(scriptsDir)
  .filter(name => name.endsWith('.ts') && statSync(join(scriptsDir, name)).isFile())
  .forEach(name => {
    const key = name.replace(/\.ts$/, '')
    execSync(`pnpm ncc build scripts/${name} -o dist/${key} --minify --target es2022`, {
      stdio: 'inherit'
    })
  })