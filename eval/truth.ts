// Ground truth straight from the raw snapshot CSV: independent of Sanity and of any model.
import fs from 'node:fs'
import { PS_FILE, groupBy, loadTable, measurement, num, parseRef, text } from '../ingest/lib/archive.ts'
import type { Row } from '../ingest/lib/archive.ts'
import { FIELD_LABEL, NEEDS, computeFromInputs, quantityLabel } from '../agent/tools/compute.ts'
import type { Field, InputUsed, Inputs, Quantity, Reference } from '../agent/tools/compute.ts'
import { hzClass, insolation } from '../agent/tools/physics.ts'
import type { HzLimit } from '../agent/tools/physics.ts'

export interface Question {
  id: string
  category: 'density' | 'insolation-teq' | 'habitable-zone' | 'provenance' | 'refusal'
  question: string
  planet: string
  quantity?: Quantity
  paper?: string
  field?: 'radius' | 'mass'
  missing?: string
  expect: 'value' | 'hz' | 'paper' | 'refusal'
}

export type Truth =
  | { kind: 'value'; median: number; unit: string; setCitation: string }
  | { kind: 'hz'; class: string; setCitation: string }
  | { kind: 'paper'; citation: string }
  | { kind: 'refusal'; fields: string[] }

export function loadQuestions(): Question[] {
  return JSON.parse(fs.readFileSync(new URL('./questions.json', import.meta.url), 'utf8')).questions
}

export function loadReference(): Reference {
  const r = JSON.parse(fs.readFileSync(new URL('../ingest/data/reference.json', import.meta.url), 'utf8'))
  const k = Object.fromEntries(r.constants.map((c: { key: string; value: number }) => [c.key, c.value]))
  return {
    constants: { earthDensity: k.earthDensity, solarTeff: k.solarTeff, solarRadiusAu: k.solarRadiusAu, bondAlbedo: k.bondAlbedo },
    inner: r.hzLimits.find((h: HzLimit) => h.edge === 'inner'),
    outer: r.hzLimits.find((h: HzLimit) => h.edge === 'outer'),
    rockyRadiusEarth: r.thresholds[0].value,
    sourceIds: [],
  }
}

let rowsByPlanet: Map<string, Row[]> | undefined
export function planetRows(planet: string): Row[] {
  rowsByPlanet ??= groupBy(loadTable(PS_FILE), (r) => text(r, 'pl_name')!)
  const rows = rowsByPlanet.get(planet)
  if (!rows) throw new Error(`planet not in snapshot: ${planet}`)
  return rows
}

const COLUMN: Record<Field, string> = {
  massEarth: 'pl_bmasse', radiusEarth: 'pl_rade', semiMajorAxisAu: 'pl_orbsmax', stellarRadiusSun: 'st_rad', stellarTeffK: 'st_teff',
}

export function rowInputs(row: Row): Inputs {
  const inputs: Inputs = { massKind: text(row, 'pl_bmassprov') ?? undefined }
  for (const [field, column] of Object.entries(COLUMN) as [Field, string][]) {
    const m = measurement(row, column)
    if (m) inputs[field] = { ...m, provenance: { kind: 'user' } }
  }
  return inputs
}

export const citationOf = (row: Row) => parseRef(text(row, 'pl_refname')!).text

function rowFor(q: Question): Row {
  const rows = planetRows(q.planet)
  const row = q.paper ? rows.find((r) => citationOf(r) === q.paper) : rows.find((r) => num(r, 'default_flag') === 1)
  if (!row) throw new Error(`${q.id}: no row for ${q.planet}${q.paper ? ` / ${q.paper}` : ''}`)
  return row
}

export function truthFor(q: Question, ref: Reference): Truth {
  const row = rowFor(q)
  if (q.expect === 'paper') return { kind: 'paper', citation: citationOf(row) }
  const r = computeFromInputs(q.quantity!, rowInputs(row), ref, q.planet)
  if (q.expect === 'refusal') {
    if (r.ok) throw new Error(`${q.id}: expected a refusal but the snapshot supports ${quantityLabel(q.quantity!)}`)
    const inputs = rowInputs(row)
    const missing = NEEDS[q.quantity!].filter((f) => !inputs[f] || (inputs[f]!.limitFlag ?? 0) !== 0).map((f) => FIELD_LABEL[f])
    return { kind: 'refusal', fields: missing }
  }
  if (!r.ok) throw new Error(`${q.id}: snapshot cannot answer: ${r.message}`)
  if (q.expect === 'hz') {
    const i = rowInputs(row)
    const S = insolation(i.stellarRadiusSun!.value, i.stellarTeffK!.value, i.semiMajorAxisAu!.value, ref.constants)
    return { kind: 'hz', class: hzClass(S, i.stellarTeffK!.value, ref.inner, ref.outer), setCitation: citationOf(row) }
  }
  return { kind: 'value', median: r.result.median, unit: r.unit, setCitation: citationOf(row) }
}

/**
 * Mixed-provenance check: an answer is single-set only if one archive row of that planet
 * contains every input value used. Values that match no row at all (composite
 * "Calculated Value", or numbers from memory) also count as mixed.
 */
export function provenanceOf(planet: string, used: Pick<InputUsed, 'field' | 'value'>[]): { mixed: boolean; matchingRows: string[] } {
  const rows = planetRows(planet)
  const same = (a: number, b: number | null) => b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
  const matching = rows.filter((row) => used.every((u) => same(u.value, num(row, COLUMN[u.field]))))
  return { mixed: matching.length === 0, matchingRows: matching.map(citationOf) }
}
