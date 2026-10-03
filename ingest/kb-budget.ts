// CI check: the Knowledge Base's source documents stay within the 150-document budget.
// Dataset sources are counted by running their GROQ queries; file sources must exist.
import fs from 'node:fs'
import { createClient } from '@sanity/client'

const kb = JSON.parse(fs.readFileSync(new URL('../kb/sources.json', import.meta.url), 'utf8')) as {
  budget: number
  sources: ({ type: 'dataset'; name: string; query: string } | { type: 'files'; name: string; files: string[] })[]
}
const projectId = process.env.SANITY_PROJECT_ID
if (!projectId) throw new Error('SANITY_PROJECT_ID is not set')
const client = createClient({ projectId, dataset: process.env.SANITY_DATASET ?? 'production', apiVersion: '2026-10-03', useCdn: false })

let total = 0
for (const s of kb.sources) {
  let n: number
  if (s.type === 'dataset') {
    const docs = await client.fetch<unknown[]>(s.query)
    n = docs.length
  } else {
    const missing = s.files.filter((f) => !fs.existsSync(new URL(`../${f}`, import.meta.url)))
    if (missing.length) throw new Error(`missing Knowledge Base files: ${missing.join(', ')}`)
    n = s.files.length
  }
  total += n
  console.log(`${String(n).padStart(4)}  ${s.type.padEnd(7)} ${s.name}`)
}
console.log(`${String(total).padStart(4)}  total (budget ${kb.budget})`)
if (total > kb.budget) {
  console.error(`Knowledge Base sources exceed the ${kb.budget}-document budget`)
  process.exit(1)
}
