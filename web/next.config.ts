import fs from 'node:fs'
import path from 'node:path'
import type { NextConfig } from 'next'

// Local dev reads the repo-root .env.local; on Vercel the same names are project env vars.
const rootEnv = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const nextConfig: NextConfig = {
  transpilePackages: ['@default-flag/agent'],
  outputFileTracingRoot: path.join(__dirname, '..'),
}

export default nextConfig
