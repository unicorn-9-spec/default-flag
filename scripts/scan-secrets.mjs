// Scan files (e.g. an exported agent session) for secrets before making them public.
//   node scripts/scan-secrets.mjs <file> [more files...]
// Checks for the literal values of every credential in .env.local plus common token
// shapes. Prints file:line and WHICH secret matched, never the value. Exit 1 on a hit.
import { existsSync, readFileSync } from 'node:fs'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/scan-secrets.mjs <file> [more files...]')
  process.exit(2)
}

const envFile = new URL('../.env.local', import.meta.url)
const literals = []
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.+)$/.exec(line.trim())
    // Only credential-like names; ids such as SANITY_PROJECT_ID are public by design.
    if (m && /TOKEN|KEY|SECRET|PASSWORD/.test(m[1]) && m[2].trim().length >= 8) literals.push([m[1], m[2].trim()])
  }
}
const shapes = [
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
  ['Bearer token', /Bearer\s+[A-Za-z0-9._-]{24,}/],
  ['Sanity token', /\bsk[A-Za-z0-9]{40,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
]

let hits = 0
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    for (const [name, value] of literals) if (line.includes(value)) { hits++; console.log(`${file}:${i + 1}: value of ${name}`) }
    for (const [name, re] of shapes) if (re.test(line)) { hits++; console.log(`${file}:${i + 1}: looks like a ${name}`) }
  })
}
console.log(hits ? `${hits} possible secret(s) found; redact before publishing.` : `clean: ${files.length} file(s), ${literals.length} credential values and ${shapes.length} patterns checked`)
process.exit(hits ? 1 : 0)
