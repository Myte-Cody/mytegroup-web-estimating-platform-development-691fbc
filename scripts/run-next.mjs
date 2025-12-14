import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mode = process.argv[2] || 'dev'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const loadEnvFile = (fileName) => {
  const fullPath = path.join(projectRoot, fileName)
  if (!fs.existsSync(fullPath)) return
  const contents = fs.readFileSync(fullPath, 'utf8')
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

// Load port-related env vars for this script (Next loads them later, but we need them now).
loadEnvFile('.env')
loadEnvFile('.env.local')

const port = process.env.NEXT_PUBLIC_CLIENT_PORT || process.env.CLIENT_PORT || process.env.PORT || '4001'

const args = mode === 'dev' ? ['dev'] : mode === 'start' ? ['start'] : ['dev']
args.push('-p', String(port))

const child = spawn('next', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 0))
