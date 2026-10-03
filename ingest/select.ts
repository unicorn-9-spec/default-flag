// Step 2: pick ~30 planets from the snapshot and record why each one is in.
// Writes data/selection.json. Pure function of the raw CSVs.
import fs from 'node:fs'
import {
  COMPOSITE_FILE, PS_FILE, TABLES_DIR, groupBy, loadTable, num, parseRef, readManifest, text,
  verifyManifest,
} from './lib/archive.ts'
import type { Row } from './lib/archive.ts'

const SPEC_WELL_KNOWN = ['K2-18 b', 'TRAPPIST-1 e', 'LHS 1140 b', 'TOI-700 d', 'Kepler-452 b']
const SPEC_REFUSAL = ['Proxima Cen b']
// Owner decision 2026-10-03 (docs/BUILD_LOG.md §9, §11).
const OWNER_PINNED = ['HD 10180 c']

const MAX_SETS_SWAP = 5
const TOP_SWAP = 6
const MAX_SETS_SPREAD = 3
const TOP_SPREAD = 8

for (const r of verifyManifest(TABLES_DIR)) {
  if (!r.ok) throw new Error(`snapshot check failed for ${r.file}: ${r.reason}`)
}

const ps = loadTable(PS_FILE)
const composite = new Map(loadTable(COMPOSITE_FILE).map((r) => [text(r, 'pl_name')!, r]))
const byPlanet = groupBy(ps, (r) => text(r, 'pl_name')!)

const defaultsOf = (rows: Row[]) => rows.filter((r) => num(r, 'default_flag') === 1)
const refText = (raw: string | null) => (raw ? parseRef(raw).text : null)
const density = (r: Row) => 5.514 * num(r, 'pl_bmasse')! / num(r, 'pl_rade')! ** 3
const measured = (r: Row, base: string) => num(r, base) !== null && num(r, `${base}lim`) === 0

interface Pick { name: string; rule: string; reason: string }
const picks: Pick[] = []

// Rule 1: mass swaps. The composite's best mass differs from the default row's and comes
// from another reference. Archive docs: best mass prefers "Mass, M*sin(i)/sin(i), or M*sin(i)".
const swaps: { name: string; ratio: number; sets: number; def: Row; comp: Row }[] = []
for (const [name, rows] of byPlanet) {
  const defs = defaultsOf(rows)
  const comp = composite.get(name)
  if (defs.length !== 1 || !comp) continue
  const def = defs[0]!
  const dm = num(def, 'pl_bmasse'), cm = num(comp, 'pl_bmasse')
  if (dm === null || cm === null || dm === cm) continue
  if (refText(text(comp, 'pl_bmasse_reflink')) === refText(text(def, 'pl_refname'))) continue
  swaps.push({ name, ratio: cm / dm, sets: rows.length, def, comp })
}
const describeSwap = (s: (typeof swaps)[number]) =>
  `default ${num(s.def, 'pl_bmasse')} M_earth (${text(s.def, 'pl_bmassprov')}, ${refText(text(s.def, 'pl_refname'))}) vs ` +
  `composite ${num(s.comp, 'pl_bmasse')} M_earth (${text(s.comp, 'pl_bmassprov')}, limit flag ${num(s.comp, 'pl_bmasselim')}, ` +
  `${refText(text(s.comp, 'pl_bmasse_reflink'))}); ratio ${s.ratio.toFixed(2)}`

for (const name of OWNER_PINNED) {
  const s = swaps.find((x) => x.name === name)
  picks.push({ name, rule: 'owner-pinned-mass-swap', reason: s ? describeSwap(s) : 'owner pinned' })
}
swaps
  .filter((s) => num(s.comp, 'pl_bmasselim') === 0 && s.sets <= MAX_SETS_SWAP)
  .sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)) || a.name.localeCompare(b.name))
  .slice(0, TOP_SWAP)
  .forEach((s) => picks.push({ name: s.name, rule: 'mass-swap-measured', reason: describeSwap(s) }))
swaps
  .filter((s) => measured(s.def, 'pl_rade') && measured(s.comp, 'pl_rade'))
  .forEach((s) => picks.push({ name: s.name, rule: 'mass-swap-with-measured-radius', reason: `${describeSwap(s)}; both rows have a measured radius, so both give a density` }))

// Rule 2 and 3: the spec's named planets.
for (const name of SPEC_WELL_KNOWN) picks.push({ name, rule: 'spec-well-known', reason: 'named in spec planet selection rule 2' })
for (const name of SPEC_REFUSAL) {
  const rows = byPlanet.get(name) ?? []
  const withRadius = rows.filter((r) => num(r, 'pl_rade') !== null).length
  picks.push({ name, rule: 'spec-refusal', reason: `${rows.length} parameter sets, ${withRadius} with a radius` })
}

// Rule 4: planets where choosing a different (self-consistent) set changes the density.
// Default must be a true mass with measured radius and full stellar/orbit inputs.
const spreads: { name: string; lo: number; hi: number; def: number; sets: number }[] = []
for (const [name, rows] of byPlanet) {
  const defs = defaultsOf(rows)
  if (defs.length !== 1 || rows.length > MAX_SETS_SPREAD) continue
  const def = defs[0]!
  if (text(def, 'pl_bmassprov') !== 'Mass' || !measured(def, 'pl_rade') || !measured(def, 'pl_bmasse')) continue
  if (['pl_orbsmax', 'st_rad', 'st_teff'].some((k) => num(def, k) === null)) continue
  const complete = rows.filter((r) => measured(r, 'pl_rade') && measured(r, 'pl_bmasse'))
  if (complete.length < 2) continue
  const d = complete.map(density)
  spreads.push({ name, lo: Math.min(...d), hi: Math.max(...d), def: density(def), sets: rows.length })
}
spreads
  .sort((a, b) => b.hi / b.lo - a.hi / a.lo || a.name.localeCompare(b.name))
  .slice(0, TOP_SPREAD)
  .forEach((s) => picks.push({
    name: s.name,
    rule: 'set-choice-changes-density',
    reason: `density across measured sets ${s.lo.toFixed(2)}-${s.hi.toFixed(2)} g/cm3 (default ${s.def.toFixed(2)}), ${s.sets} sets`,
  }))

// Merge picks per planet; fail loudly on a name that is not in the snapshot.
const merged = new Map<string, { name: string; rules: string[]; reasons: string[] }>()
for (const p of picks) {
  if (!byPlanet.has(p.name)) throw new Error(`selected planet not in snapshot: ${p.name}`)
  const m = merged.get(p.name) ?? { name: p.name, rules: [], reasons: [] }
  if (!m.rules.includes(p.rule)) { m.rules.push(p.rule); m.reasons.push(p.reason) }
  merged.set(p.name, m)
}
const planets = [...merged.values()]
  .map((m) => ({ ...m, parameterSets: byPlanet.get(m.name)!.length, defaults: defaultsOf(byPlanet.get(m.name)!).length }))
  .sort((a, b) => a.name.localeCompare(b.name))

const manifest = readManifest(TABLES_DIR)
const out = {
  snapshot: manifest.map(({ file, sha256 }) => ({ file, sha256 })),
  rules: {
    'owner-pinned-mass-swap': 'Pinned by the owner as the flagship mass-provenance case.',
    'mass-swap-measured': `Composite best mass differs from the default row and comes from another reference, composite limit flag 0, <=${MAX_SETS_SWAP} sets; top ${TOP_SWAP} by |ln(composite/default)|.`,
    'mass-swap-with-measured-radius': 'Mass swap where default and composite both carry a measured radius (limit flag 0).',
    'spec-well-known': 'Named in the spec.',
    'spec-refusal': 'Named in the spec as a refusal case.',
    'set-choice-changes-density': `Default is a true mass with measured radius and complete orbit/stellar inputs, <=${MAX_SETS_SPREAD} sets, >=2 measured sets; top ${TOP_SPREAD} by max/min density.`,
  },
  totals: {
    planets: planets.length,
    parameterSets: planets.reduce((n, p) => n + p.parameterSets, 0),
    swapPopulation: swaps.length,
    swapPopulationMeasured: swaps.filter((s) => num(s.comp, 'pl_bmasselim') === 0).length,
  },
  planets,
}
fs.writeFileSync(new URL('./data/selection.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`selected ${out.totals.planets} planets, ${out.totals.parameterSets} parameter sets`)
for (const p of planets) console.log(`  ${p.name.padEnd(18)} sets=${p.parameterSets} defaults=${p.defaults} ${p.rules.join(',')}`)
