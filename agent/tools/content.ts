// Reads the snapshot stored in Sanity (public dataset, no token) and assembles inputs
// for compute. The model never calls this directly with free-form GROQ.
import { createClient } from '@sanity/client'
import type { SanityClient } from '@sanity/client'
import { computeFromInputs } from './compute.ts'
import type { ComputeResult, Field, InputValue, Inputs, Quantity, Reference } from './compute.ts'
import type { HzLimit } from './physics.ts'

export const API_VERSION = '2026-10-03'

let client: SanityClient | undefined
export function sanity(): SanityClient {
  if (client) return client
  const projectId = process.env.SANITY_PROJECT_ID
  if (!projectId) throw new Error('SANITY_PROJECT_ID is not set')
  client = createClient({ projectId, dataset: process.env.SANITY_DATASET ?? 'production', apiVersion: API_VERSION, useCdn: false })
  return client
}

interface M { value: number; errPlus?: number; errMinus?: number; limitFlag?: number }
interface Pub { _id: string; citation: string; bibcode?: string; adsUrl?: string }

export async function fetchReference(): Promise<Reference> {
  const r = await sanity().fetch<{
    constants: { _id: string; key: string; value: number }[]
    hz: (HzLimit & { _id: string })[]
    rocky: { _id: string; value: number } | null
  }>(`{
    "constants": *[_type == "constant"]{_id, key, value},
    "hz": *[_type == "hzLimit"]{_id, name, edge, seffSun, a, b, c, d, teffMinK, teffMaxK},
    "rocky": *[_id == "threshold-rocky-radius"][0]{_id, value}
  }`)
  const k = Object.fromEntries(r.constants.map((c) => [c.key, c.value]))
  for (const key of ['earthDensity', 'solarTeff', 'solarRadiusAu', 'bondAlbedo']) {
    if (typeof k[key] !== 'number') throw new Error(`constant ${key} missing from dataset`)
  }
  const inner = r.hz.find((h) => h.edge === 'inner')
  const outer = r.hz.find((h) => h.edge === 'outer')
  if (!inner || !outer || !r.rocky) throw new Error('habitable-zone limits or rocky threshold missing from dataset')
  return {
    constants: { earthDensity: k.earthDensity!, solarTeff: k.solarTeff!, solarRadiusAu: k.solarRadiusAu!, bondAlbedo: k.bondAlbedo! },
    inner, outer, rockyRadiusEarth: r.rocky.value,
    sourceIds: [...r.constants.map((c) => c._id), ...r.hz.map((h) => h._id), r.rocky._id].sort(),
  }
}

export interface SetRecord {
  _id: string
  defaultFlag: boolean
  massKind?: string
  radiusEarth?: M
  massEarth?: M
  semiMajorAxisAu?: M
  planet: { _id: string; name: string; slug: string }
  publication: Pub
  stellar?: { _id: string; radiusSun?: M; teffK?: M; massSun?: M; publication: Pub }
}

const SET_PROJECTION = `{
  _id, defaultFlag, massKind, radiusEarth, massEarth, semiMajorAxisAu,
  "planet": planet->{_id, name, "slug": slug.current},
  "publication": publication->{_id, citation, bibcode, adsUrl},
  "stellar": stellarSolution->{_id, radiusSun, teffK, massSun, "publication": publication->{_id, citation, bibcode, adsUrl}}
}`

export async function fetchSet(setId: string): Promise<SetRecord | null> {
  return sanity().fetch(`*[_type == "parameterSet" && _id == $setId][0]${SET_PROJECTION}`, { setId })
}

export interface CompositeValue { measurement?: M; calculated?: boolean; referenceText?: string; publication?: Pub }
export interface PlanetRecord {
  _id: string
  name: string
  slug: string
  host: string
  defaultSetId: string
  sets: SetRecord[]
  composite: Partial<Record<'radiusEarth' | 'massEarth' | 'semiMajorAxisAu' | 'stellarRadiusSun' | 'stellarTeffK' | 'insolationEarth' | 'eqTempK', CompositeValue>> & { massKind?: string }
  selection?: { rules: string[]; reasons: string[] }
}

const COMPOSITE_FIELDS = ['radiusEarth', 'massEarth', 'semiMajorAxisAu', 'stellarRadiusSun', 'stellarTeffK', 'insolationEarth', 'eqTempK']

export async function fetchPlanet(slugOrName: string): Promise<PlanetRecord | null> {
  const compositeProjection = COMPOSITE_FIELDS.map(
    (f) => `"${f}": compositeSnapshot.${f}{measurement, calculated, referenceText, "publication": publication->{_id, citation, bibcode, adsUrl}}`,
  ).join(', ')
  return sanity().fetch(
    `*[_type == "planet" && (slug.current == $key || lower(name) == lower($name))][0]{
      _id, name, "slug": slug.current, "host": host->name, "defaultSetId": defaultParameterSet._ref, selection,
      "sets": parameterSets[]->${SET_PROJECTION},
      "composite": { ${compositeProjection}, "massKind": compositeSnapshot.massKind }
    }`,
    { key: slugOrName, name: slugOrName },
  )
}

export async function listPlanets(): Promise<{ name: string; slug: string; host: string; sets: number }[]> {
  return sanity().fetch(`*[_type == "planet"] | order(name asc){name, "slug": slug.current, "host": host->name, "sets": count(parameterSets)}`)
}

const val = (m: M | undefined, provenance: InputValue['provenance']): InputValue | undefined =>
  m ? { value: m.value, errPlus: m.errPlus, errMinus: m.errMinus, limitFlag: m.limitFlag, provenance } : undefined

/** Inputs from exactly one archive row: its planet values and the stellar solution published with it. */
export function setInputs(set: SetRecord): Inputs {
  const own = { kind: 'parameterSet' as const, id: set._id, setId: set._id, citation: set.publication.citation }
  const star = set.stellar
    ? { kind: 'stellarSolution' as const, id: set.stellar._id, setId: set._id, citation: set.stellar.publication.citation }
    : undefined
  const inputs: Inputs = { massKind: set.massKind }
  const assign = (f: Field, v: InputValue | undefined) => { if (v) inputs[f] = v }
  assign('massEarth', val(set.massEarth, own))
  assign('radiusEarth', val(set.radiusEarth, own))
  assign('semiMajorAxisAu', val(set.semiMajorAxisAu, own))
  if (star) {
    assign('stellarRadiusSun', val(set.stellar!.radiusSun, star))
    assign('stellarTeffK', val(set.stellar!.teffK, star))
  }
  return inputs
}

/** Inputs from the composite row: each value carries its own (possibly different) reference. */
export function compositeInputs(planet: PlanetRecord): Inputs {
  const inputs: Inputs = { massKind: planet.composite.massKind }
  for (const f of ['massEarth', 'radiusEarth', 'semiMajorAxisAu', 'stellarRadiusSun', 'stellarTeffK'] as Field[]) {
    const c = planet.composite[f]
    if (!c?.measurement) continue
    inputs[f] = val(c.measurement, {
      kind: 'composite', id: c.publication?._id, citation: c.calculated ? 'Calculated Value' : c.publication?.citation ?? c.referenceText,
      calculated: c.calculated ?? false,
    })
  }
  return inputs
}

export async function computeForSet(setId: string, quantity: Quantity, ref?: Reference): Promise<ComputeResult & { setId: string; planet?: string; publication?: string; defaultFlag?: boolean }> {
  const set = await fetchSet(setId)
  if (!set) throw new Error(`no parameter set with id ${setId}`)
  const r = ref ?? (await fetchReference())
  const result = computeFromInputs(quantity, setInputs(set), r, set.planet.name)
  return { ...result, setId, planet: set.planet.name, publication: set.publication.citation, defaultFlag: set.defaultFlag }
}

export async function compositeCounterfactual(planetKey: string, quantity: Quantity, ref?: Reference) {
  const planet = await fetchPlanet(planetKey)
  if (!planet) throw new Error(`no planet ${planetKey}`)
  const r = ref ?? (await fetchReference())
  const result = computeFromInputs(quantity, compositeInputs(planet), r, `${planet.name} (composite row)`)
  return { ...result, planet: planet.name, source: 'pscomppars' as const }
}
