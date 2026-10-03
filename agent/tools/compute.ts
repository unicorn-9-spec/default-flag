// compute / composite_counterfactual: the only code paths that produce numbers.
import {
  density, eqTemp, hzClass, hzProbability, insolation, monteCarlo, seff,
} from './physics.ts'
import type { Constants, HzLimit, Interval, Uncertain } from './physics.ts'

export const CODE_VERSION = 'physics-1'
export const QUANTITIES = ['density', 'insolation', 'eqTemp', 'hzStatus'] as const
export type Quantity = (typeof QUANTITIES)[number]

export interface Reference {
  constants: Constants
  inner: HzLimit
  outer: HzLimit
  rockyRadiusEarth: number
  sourceIds: string[]
}

export type Field = 'massEarth' | 'radiusEarth' | 'semiMajorAxisAu' | 'stellarRadiusSun' | 'stellarTeffK'

export const FIELD_LABEL: Record<Field, string> = {
  massEarth: 'planet mass',
  radiusEarth: 'planet radius',
  semiMajorAxisAu: 'semi-major axis',
  stellarRadiusSun: 'stellar radius',
  stellarTeffK: 'stellar effective temperature',
}
const UNIT: Record<Field, string> = {
  massEarth: 'M_earth', radiusEarth: 'R_earth', semiMajorAxisAu: 'AU', stellarRadiusSun: 'R_sun', stellarTeffK: 'K',
}
export const NEEDS: Record<Quantity, Field[]> = {
  density: ['massEarth', 'radiusEarth'],
  insolation: ['stellarRadiusSun', 'stellarTeffK', 'semiMajorAxisAu'],
  eqTemp: ['stellarRadiusSun', 'stellarTeffK', 'semiMajorAxisAu'],
  hzStatus: ['stellarRadiusSun', 'stellarTeffK', 'semiMajorAxisAu'],
}
const RESULT_UNIT: Record<Quantity, string> = { density: 'g/cm3', insolation: 'S_earth', eqTemp: 'K', hzStatus: 'S_earth' }

/** Where an input value came from. For a parameter set all inputs share one set id. */
export interface Provenance {
  kind: 'parameterSet' | 'stellarSolution' | 'composite' | 'user'
  id?: string
  /** The archive row (parameter set) this value belongs to; absent for composite and user values. */
  setId?: string
  citation?: string
  calculated?: boolean
}

export interface InputValue extends Uncertain {
  limitFlag?: number
  provenance: Provenance
}

export type Inputs = Partial<Record<Field, InputValue>> & { massKind?: string }

export interface InputUsed {
  field: Field
  label: string
  value: number
  errPlus?: number
  errMinus?: number
  unit: string
  provenance: Provenance
}

export interface ComputeOk {
  ok: true
  quantity: Quantity
  unit: string
  result: Interval
  inputs: InputUsed[]
  flags: string[]
  /** Distinct publications behind the inputs (calculated values count as one source). */
  distinctSources: string[]
  hz?: { class: string; probabilityInside: number; innerSeff: number; outerSeff: number; limits: [string, string] }
  densityClass?: { rockyRadiusEarth: number; radiusAboveRockyLimit: boolean }
  /** Archive pl_bmassprov of the mass used (density only). */
  massKind?: string
  constantsUsed: string[]
  codeVersion: string
}

export interface ComputeRefusal {
  ok: false
  quantity: Quantity
  reason: 'missing' | 'limit'
  field: Field
  fieldLabel: string
  message: string
}

export type ComputeResult = ComputeOk | ComputeRefusal

/** Core: computes one quantity from already-gathered inputs. Never fetches. */
export function computeFromInputs(quantity: Quantity, inputs: Inputs, ref: Reference, subject: string): ComputeResult {
  for (const field of NEEDS[quantity]) {
    const v = inputs[field]
    if (!v || !Number.isFinite(v.value)) {
      return {
        ok: false, quantity, reason: 'missing', field, fieldLabel: FIELD_LABEL[field],
        message: `${subject} has no ${FIELD_LABEL[field]} in this source, so its ${quantityLabel(quantity)} can't be computed.`,
      }
    }
    if (v.limitFlag !== undefined && v.limitFlag !== 0) {
      return {
        ok: false, quantity, reason: 'limit', field, fieldLabel: FIELD_LABEL[field],
        message: `The archive marks ${subject}'s ${FIELD_LABEL[field]} (${v.value} ${UNIT[field]}) as a limit, not a measurement, so its ${quantityLabel(quantity)} can't be computed.`,
      }
    }
  }
  const used = NEEDS[quantity].map((field): InputUsed => {
    const v = inputs[field]!
    return {
      field, label: FIELD_LABEL[field], value: v.value, unit: UNIT[field], provenance: v.provenance,
      ...(v.errPlus !== undefined && { errPlus: v.errPlus }),
      ...(v.errMinus !== undefined && { errMinus: v.errMinus }),
    }
  })
  const flags: string[] = used.filter((u) => u.errPlus === undefined && u.errMinus === undefined).map((u) => `no-uncertainty:${u.field}`)
  const u = (f: Field): Uncertain => inputs[f]!
  const c = ref.constants
  const base = {
    ok: true as const, quantity, unit: RESULT_UNIT[quantity], inputs: used, flags,
    distinctSources: distinctSources(used), codeVersion: CODE_VERSION,
  }

  if (quantity === 'density') {
    if (inputs.massKind === 'Msini') flags.push('minimum-mass: the archive mass is M*sin(i), a lower limit, so this density is a lower limit')
    const result = monteCarlo({ m: u('massEarth'), r: u('radiusEarth') }, (v) => density(v.m, v.r, c))
    return {
      ...base, result, ...(inputs.massKind && { massKind: inputs.massKind }),
      densityClass: { rockyRadiusEarth: ref.rockyRadiusEarth, radiusAboveRockyLimit: inputs.radiusEarth!.value > ref.rockyRadiusEarth },
      constantsUsed: ['constant-earth-density', 'threshold-rocky-radius'],
    }
  }

  const stellar = { r: u('stellarRadiusSun'), t: u('stellarTeffK'), a: u('semiMajorAxisAu') }
  if (quantity === 'insolation') {
    return { ...base, result: monteCarlo(stellar, (v) => insolation(v.r, v.t, v.a, c)), constantsUsed: ['constant-solar-teff'] }
  }
  if (quantity === 'eqTemp') {
    return {
      ...base, result: monteCarlo(stellar, (v) => eqTemp(v.r, v.t, v.a, c)),
      constantsUsed: ['constant-solar-radius-au', 'constant-bond-albedo'],
    }
  }
  // hzStatus
  const teff = inputs.stellarTeffK!.value
  if (teff < ref.inner.teffMinK || teff > ref.inner.teffMaxK) {
    flags.push(`teff-outside-hz-fit: Teff ${teff} K is outside the ${ref.inner.teffMinK}-${ref.inner.teffMaxK} K range the Kopparapu et al. 2014 fit covers, so the limits are extrapolated`)
  }
  const result = monteCarlo(stellar, (v) => insolation(v.r, v.t, v.a, c))
  const S = insolation(stellar.r.value, teff, stellar.a.value, c)
  return {
    ...base, result,
    hz: {
      class: hzClass(S, teff, ref.inner, ref.outer),
      probabilityInside: hzProbability({ radiusSun: stellar.r, teffK: stellar.t, semiMajorAxisAu: stellar.a }, c, ref.inner, ref.outer),
      innerSeff: seff(ref.inner, teff),
      outerSeff: seff(ref.outer, teff),
      limits: [ref.inner.name, ref.outer.name],
    },
    constantsUsed: ['constant-solar-teff', 'hzlimit-runaway-greenhouse-1me', 'hzlimit-maximum-greenhouse'],
  }
}

function distinctSources(used: InputUsed[]): string[] {
  const keys = used.map((u) => (u.provenance.calculated ? 'Calculated Value' : u.provenance.citation ?? u.provenance.id ?? u.provenance.kind))
  return [...new Set(keys)].sort()
}

export function quantityLabel(q: Quantity): string {
  return { density: 'density', insolation: 'insolation', eqTemp: 'equilibrium temperature', hzStatus: 'habitable-zone status' }[q]
}
