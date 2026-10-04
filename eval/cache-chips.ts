// Pre-computes the three example-chip answers with the live agent and stores them for
// the site, labelled "cached". Each must pass the output guard to be cached.
import fs from 'node:fs'
import { runAgent } from '../agent/agent.ts'
import { loadEnv } from '../agent/env.ts'
import { sanity } from '../agent/tools/content.ts'

const CHIPS = ['Density of Kepler-139 d?', 'Is TRAPPIST-1 e in the habitable zone?', 'Density of Proxima Cen b?']

loadEnv()
const snapshots = await sanity().fetch(`*[_type == "snapshot"] | order(file asc){file, table, sha256, rows, retrievedAt}`)
const out: Record<string, unknown> = {}
for (const q of CHIPS) {
  const run = await runAgent(q)
  if (run.status !== 'answered') throw new Error(`${q}: guard failed: ${run.guard.violations.join('; ')}`)
  out[q] = { run, snapshots, computedAt: new Date().toISOString() }
  console.log(`${q}\n  ${run.answer}\n  guard ok${run.guard.retried ? ' after retry' : ''}, ${run.trace.length} tool calls\n`)
}
fs.writeFileSync(new URL('../web/data/cached.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
