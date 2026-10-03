// Step 3: snapshot + selection.json -> data/out/production.ndjson.
// Deterministic: ids come from source keys, keys are sorted, output is sorted by _id,
// so two runs on the same snapshot produce byte-identical files.
import fs from 'node:fs'
import {
  COMPOSITE_FILE, PS_FILE, TABLES_DIR, buildRefSlugger, groupBy, loadTable, measurement, num,
  parseRef, readManifest, sha256, slugify, text, verifyManifest,
} from './lib/archive.ts'
import type { Measurement, ParsedRef, Row } from './lib/archive.ts'

type Doc = { _id: string; _type: string; [k: string]: unknown }
const ref = (id: string) => ({ _type: 'reference', _ref: id })

for (const r of verifyManifest(TABLES_DIR)) {
  if (!r.ok) throw new Error(`snapshot check failed for ${r.file}: ${r.reason}`)
}
const selection: { snapshot: { file: string; sha256: string }[]; planets: { name: string; rules: string[]; reasons: string[] }[] } =
  JSON.parse(fs.readFileSync(new URL('./data/selection.json', import.meta.url), 'utf8'))
const manifest = readManifest(TABLES_DIR)
for (const s of selection.snapshot) {
  if (manifest.find((m) => m.file === s.file)?.sha256 !== s.sha256) {
    throw new Error(`selection.json was built from a different ${s.file}; rerun select.ts`)
  }
}

const ps = loadTable(PS_FILE)
const compositeRows = loadTable(COMPOSITE_FILE)
const composite = new Map(compositeRows.map((r) => [text(r, 'pl_name')!, r]))
const byPlanet = groupBy(ps, (r) => text(r, 'pl_name')!)

// Publication ids are decided against every reference in both tables, so adding or
// removing a planet from the selection never renames a publication.
const allRefs: ParsedRef[] = []
for (const r of ps) for (const k of ['pl_refname', 'st_refname']) if (text(r, k)) allRefs.push(parseRef(text(r, k)!))
for (const r of compositeRows) for (const k of Object.keys(r)) if (k.endsWith('_reflink') && text(r, k)) allRefs.push(parseRef(text(r, k)!))
const refSlug = buildRefSlugger(allRefs)

const docs = new Map<string, Doc>()
const put = (doc: Doc) => {
  const prev = docs.get(doc._id)
  if (prev && JSON.stringify(sortKeys(prev)) !== JSON.stringify(sortKeys(doc))) {
    throw new Error(`conflicting documents for id ${doc._id}`)
  }
  docs.set(doc._id, doc)
}

const snapshotId = (file: string) => `snapshot-${slugify(file)}`
for (const m of manifest) {
  put({
    _id: snapshotId(m.file),
    _type: 'snapshot',
    file: `ingest/data/raw/nea-tables/${m.file}`,
    table: m.table,
    sha256: m.sha256,
    sizeBytes: m.sizeBytes,
    rows: m.rows,
    sourceUrl: m.sourceUrl,
    retrievedAt: m.retrievedAtUtc,
  })
}

function publication(raw: string): string {
  const p = parseRef(raw)
  if (p.calculated) throw new Error('a calculated value has no publication')
  const id = `pub-${refSlug(p)}`
  put({
    _id: id,
    _type: 'publication',
    citation: p.text,
    refname: p.raw,
    ...(p.refstr && { refstr: p.refstr }),
    ...(p.bibcode && { bibcode: p.bibcode }),
    ...(p.year !== null && { year: p.year }),
    ...(p.url && { adsUrl: p.url }),
  })
  return id
}

const withMeasurements = (fields: Record<string, Measurement | null>) =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))

// Stellar solutions are shared by planets of one host when the archive gives the
// same reference and the same values; a differing variant gets a content-hash suffix.
const stellarIds = new Map<string, string>()
function stellarSolution(row: Row, hostSlug: string): string | null {
  const raw = text(row, 'st_refname')
  const values = withMeasurements({
    radiusSun: measurement(row, 'st_rad'),
    massSun: measurement(row, 'st_mass'),
    teffK: measurement(row, 'st_teff'),
  })
  if (!raw || Object.keys(values).length === 0) return null
  const pubId = publication(raw)
  const base = `stsol-${hostSlug}-${pubId.slice('pub-'.length)}`
  const content = JSON.stringify(sortKeys(values))
  const key = `${base}|${content}`
  let id = stellarIds.get(key)
  if (!id) {
    const taken = [...stellarIds.entries()].some(([k]) => k.startsWith(`${base}|`))
    id = taken ? `${base}-${sha256(content).slice(0, 8)}` : base
    stellarIds.set(key, id)
  }
  put({ _id: id, _type: 'stellarSolution', star: ref(`star-${hostSlug}`), publication: ref(pubId), ...values, snapshot: ref(snapshotId(PS_FILE)) })
  return id
}

const compositeFields: [string, string][] = [
  ['radiusEarth', 'pl_rade'],
  ['massEarth', 'pl_bmasse'],
  ['semiMajorAxisAu', 'pl_orbsmax'],
  ['insolationEarth', 'pl_insol'],
  ['eqTempK', 'pl_eqt'],
  ['stellarRadiusSun', 'st_rad'],
  ['stellarMassSun', 'st_mass'],
  ['stellarTeffK', 'st_teff'],
]

const issues: string[] = []
for (const sel of selection.planets) {
  const rows = byPlanet.get(sel.name)
  const comp = composite.get(sel.name)
  if (!rows || !comp) throw new Error(`selected planet missing from snapshot: ${sel.name}`)
  const planetSlug = slugify(sel.name)
  const planetId = `planet-${planetSlug}`
  const host = text(rows[0]!, 'hostname')!
  const hostSlug = slugify(host)
  put({ _id: `star-${hostSlug}`, _type: 'star', name: host, slug: { _type: 'slug', current: hostSlug } })

  const setIds: string[] = []
  let defaultId: string | null = null
  for (const row of rows) {
    const pubId = publication(text(row, 'pl_refname')!)
    let id = `pset-${planetSlug}-${pubId.slice('pub-'.length)}`
    const rowHash = sha256(JSON.stringify(row))
    if (setIds.includes(id)) id = `${id}-${rowHash.slice(0, 8)}`
    setIds.push(id)
    const isDefault = num(row, 'default_flag') === 1
    if (isDefault) defaultId = id
    const stellar = stellarSolution(row, hostSlug)
    if (text(row, 'st_refname') && text(row, 'st_refname') !== text(row, 'pl_refname')) {
      issues.push(`${sel.name}: ${pubId} uses stellar reference ${parseRef(text(row, 'st_refname')!).text}`)
    }
    put({
      _id: id,
      _type: 'parameterSet',
      planet: ref(planetId),
      publication: ref(pubId),
      defaultFlag: isDefault,
      ...withMeasurements({
        radiusEarth: measurement(row, 'pl_rade'),
        massEarth: measurement(row, 'pl_bmasse'),
        semiMajorAxisAu: measurement(row, 'pl_orbsmax'),
        archiveInsolationEarth: measurement(row, 'pl_insol'),
        archiveEqTempK: measurement(row, 'pl_eqt'),
      }),
      ...(text(row, 'pl_bmassprov') && { massKind: text(row, 'pl_bmassprov') }),
      ...(stellar && { stellarSolution: ref(stellar) }),
      ...(text(row, 'soltype') && { solutionType: text(row, 'soltype') }),
      controversial: num(row, 'pl_controv_flag') === 1,
      ...(text(row, 'pl_pubdate') && { publishedMonth: text(row, 'pl_pubdate') }),
      snapshot: ref(snapshotId(PS_FILE)),
      archiveRowSha256: rowHash,
    })
  }
  if (rows.filter((r) => num(r, 'default_flag') === 1).length !== 1 || !defaultId) {
    throw new Error(`${sel.name}: expected exactly one default parameter set`)
  }

  const compositeSnapshot: Record<string, unknown> = { snapshot: ref(snapshotId(COMPOSITE_FILE)) }
  for (const [field, column] of compositeFields) {
    const m = measurement(comp, column)
    if (!m) continue
    const rawRef = text(comp, `${column}_reflink`)
    const parsed = rawRef ? parseRef(rawRef) : null
    compositeSnapshot[field] = {
      _type: 'compositeValue',
      measurement: m,
      ...(parsed && { referenceText: parsed.text, calculated: parsed.calculated }),
      ...(parsed && !parsed.calculated && { publication: ref(publication(rawRef!)) }),
    }
  }
  if (text(comp, 'pl_bmassprov')) compositeSnapshot.massKind = text(comp, 'pl_bmassprov')

  const sortedSets = [...setIds].sort()
  put({
    _id: planetId,
    _type: 'planet',
    name: sel.name,
    slug: { _type: 'slug', current: planetSlug },
    host: ref(`star-${hostSlug}`),
    parameterSets: sortedSets.map((id) => ({ _key: sha256(id).slice(0, 12), ...ref(id) })),
    defaultParameterSet: ref(defaultId),
    compositeSnapshot,
    selection: { rules: sel.rules, reasons: sel.reasons },
  })
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]))
  }
  return value
}

for (const id of docs.keys()) {
  if (id.includes('.') || id.length > 128 || !/^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/.test(id)) throw new Error(`invalid public id: ${id}`)
}
const ndjson = [...docs.values()]
  .sort((a, b) => (a._id < b._id ? -1 : 1))
  .map((d) => JSON.stringify(sortKeys(d)))
  .join('\n') + '\n'
fs.mkdirSync(new URL('./data/out/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL('./data/out/production.ndjson', import.meta.url), ndjson)

const counts = groupBy([...docs.values()], (d) => d._type)
console.log(`wrote ${docs.size} documents, sha256 ${sha256(ndjson)}`)
for (const [type, list] of [...counts].sort()) console.log(`  ${type.padEnd(16)} ${list.length}`)
console.log(`${issues.length} parameter sets whose stellar reference differs from the planet reference (both stored)`)
