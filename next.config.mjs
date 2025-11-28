import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep tracing inside this project to avoid cross-root resolution issues.
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
