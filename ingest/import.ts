// Step 4: push data/out/production.ndjson to the dataset, writing only what changed.
// A second run on the same NDJSON must report 0 created, 0 updated, 0 deleted.
// Usage: node import.ts [--dry-run]
import fs from 'node:fs'
import { createClient } from '@sanity/client'

const envFile = new URL('../.env.local', import.meta.url)
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

const { SANITY_PROJECT_ID, SANITY_DATASET = 'production', SANITY_API_WRITE_TOKEN } = process.env
if (!SANITY_PROJECT_ID || !SANITY_API_WRITE_TOKEN) {
  throw new Error('SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN must be set in .env.local')
}
const dryRun = process.argv.includes('--dry-run')

type Doc = { _id: string; _type: string; [k: string]: unknown }
const SYSTEM_FIELDS = new Set(['_rev', '_createdAt', '_updatedAt'])

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((k) => !SYSTEM_FIELDS.has(k))
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}

const wanted: Doc[] = fs
  .readFileSync(new URL('./data/out/production.ndjson', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
const types = [...new Set(wanted.map((d) => d._type))].sort()

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: '2026-10-03',
  token: SANITY_API_WRITE_TOKEN,
  useCdn: false,
  perspective: 'published',
})

const existing: Doc[] = await client.fetch('*[_type in $types]', { types })
const existingById = new Map(existing.map((d) => [d._id, d]))
const wantedIds = new Set(wanted.map((d) => d._id))

const create = wanted.filter((d) => !existingById.has(d._id))
const update = wanted.filter(
  (d) => existingById.has(d._id) && JSON.stringify(canonical(d)) !== JSON.stringify(canonical(existingById.get(d._id))),
)
// Only documents of the types this pipeline owns are candidates for deletion.
const remove = existing.filter((d) => !wantedIds.has(d._id))

console.log(`${SANITY_DATASET}: ${wanted.length} wanted, ${existing.length} existing`)
console.log(`create ${create.length}, update ${update.length}, delete ${remove.length}${dryRun ? ' (dry run)' : ''}`)
for (const d of update.slice(0, 10)) console.log(`  update ${d._id}`)
for (const d of remove.slice(0, 10)) console.log(`  delete ${d._id}`)

if (!dryRun && create.length + update.length + remove.length > 0) {
  // One transaction: planets and parameter sets reference each other.
  const tx = client.transaction()
  for (const d of [...create, ...update]) tx.createOrReplace(d)
  for (const d of remove) tx.delete(d._id)
  const res = await tx.commit({ visibility: 'sync' })
  console.log(`committed transaction ${res.transactionId}`)
}
