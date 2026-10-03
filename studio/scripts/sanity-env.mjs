// Runs the Sanity CLI with the repo's .env.local loaded, mapping the project-level
// names onto the SANITY_STUDIO_* names the Studio config reads. Never prints values.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'

const envFile = new URL('../../.env.local', import.meta.url)
if (existsSync(envFile)) process.loadEnvFile(envFile)

process.env.SANITY_STUDIO_PROJECT_ID ||= process.env.SANITY_PROJECT_ID ?? ''
process.env.SANITY_STUDIO_DATASET ||= process.env.SANITY_DATASET ?? 'production'

if (!process.env.SANITY_STUDIO_PROJECT_ID) {
  console.error('SANITY_PROJECT_ID is not set in .env.local')
  process.exit(1)
}

// Works whether invoked via pnpm (bin already on PATH) or directly with node.
const bin = fileURLToPath(new URL('../node_modules/.bin', import.meta.url))
process.env.PATH = `${bin}${delimiter}${process.env.PATH ?? ''}`

const result = spawnSync('sanity', process.argv.slice(2), { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
