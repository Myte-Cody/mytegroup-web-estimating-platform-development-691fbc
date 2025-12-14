import { spawn } from 'node:child_process'

const mode = process.argv[2] || 'dev'
const port =
  process.env.PORT ||
  process.env.CLIENT_PORT ||
  process.env.NEXT_PUBLIC_CLIENT_PORT ||
  '4001'

const args = mode === 'dev' ? ['dev'] : mode === 'start' ? ['start'] : ['dev']
args.push('-p', String(port))

const child = spawn('next', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 0))
