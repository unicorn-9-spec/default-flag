// Loads the repo-root .env.local for command-line scripts (eval, probes). Kept out of
// config.ts so the web bundle never references the file: Turbopack resolves
// `new URL(..., import.meta.url)` as an asset at build time, and CI has no .env.local.
import fs from 'node:fs'

export function loadEnv(): void {
  const file = new URL('../.env.local', import.meta.url)
  if (fs.existsSync(file)) process.loadEnvFile(file)
}
