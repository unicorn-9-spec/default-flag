// One command to finish the build once the `default-flag-data` Context endpoint exists:
//   node scripts/finish.mjs            (all steps)
//   node scripts/finish.mjs --no-deploy
// Steps: probe both Context endpoints -> cache the three chip answers -> full four-arm
// evaluation -> unit tests -> production build -> Vercel production deploy.
// Prints statuses only, never credentials. Stops at the first failing step.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const envFile = new URL('.env.local', root)
if (existsSync(envFile)) process.loadEnvFile(envFile)
const deploy = !process.argv.includes('--no-deploy')

function step(name, cmd, args, opts = {}) {
  console.log(`\n=== ${name}`)
  const r = spawnSync(cmd, args, { cwd: root, stdio: opts.capture ? 'pipe' : 'inherit', shell: true, encoding: 'utf8' })
  if (opts.capture) process.stdout.write(r.stdout ?? '')
  if (r.status !== 0) {
    console.error(`\n${name} failed (exit ${r.status}). Fix it and rerun; earlier steps are safe to repeat.`)
    process.exit(r.status ?? 1)
  }
  return r.stdout ?? ''
}

const probe = step('Probe Sanity Context endpoints', 'node', ['agent/scripts/probe.ts'], { capture: true })
if (/^data: FAILED/m.test(probe)) {
  console.error('\nThe dataset endpoint is still unavailable. Create `default-flag-data` in the Context app (see docs/OWNER_STEPS.md).')
  process.exit(1)
}
step('Cache the three chip answers (live agent, guard must pass)', 'node', ['eval/cache-chips.ts'])
step('Full four-arm evaluation (writes eval/results/<date>.* and web/data/eval-latest.json)', 'node', ['eval/run.ts'])
step('Unit tests and offline evaluation subset', 'node', ['node_modules/vitest/vitest.mjs', 'run'])
step('Dataset validation', 'node', ['ingest/check-dataset.ts'])
if (deploy) {
  if (!process.env.VERCEL_TOKEN) {
    console.error('VERCEL_TOKEN is not set in .env.local; skipping deploy.')
    process.exit(1)
  }
  step('Deploy to Vercel production', 'vercel', ['deploy', '--prod', '--yes', '--token', process.env.VERCEL_TOKEN])
}
const latest = new URL('web/data/eval-latest.json', root)
if (existsSync(latest)) {
  const r = JSON.parse(readFileSync(latest, 'utf8'))
  console.log(`\nDone. Evaluation ${r.date} with ${r.model} (${r.modelVersion}). Results table: eval/results/${r.date.slice(0, 10)}.md`)
}
console.log('Next: commit eval/results, web/data and push when GitHub access is back (docs/OWNER_STEPS.md).')
