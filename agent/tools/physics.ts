// Deterministic physics. Code computes; the model only explains.
// Every function is pure; Monte Carlo uses a seeded generator so results reproduce.

export interface Constants {
  earthDensity: number // g/cm3
  solarTeff: number // K
  solarRadiusAu: number // AU per R_sun
  bondAlbedo: number
}

export interface HzLimit {
  name: string
  edge: 'inner' | 'outer'
  seffSun: number
  a: number
  b: number
  c: number
  d: number
  teffMinK: number
  teffMaxK: number
}

/** Bulk density in g/cm3 from mass and radius in Earth units. */
export function density(massEarth: number, radiusEarth: number, c: Constants): number {
  return c.earthDensity * massEarth / radiusEarth ** 3
}

/** Stellar luminosity in L_sun from radius (R_sun) and Teff (K). */
export function luminosity(radiusSun: number, teffK: number, c: Constants): number {
  return radiusSun ** 2 * (teffK / c.solarTeff) ** 4
}

/** Insolation in S_earth. */
export function insolation(radiusSun: number, teffK: number, semiMajorAxisAu: number, c: Constants): number {
  return luminosity(radiusSun, teffK, c) / semiMajorAxisAu ** 2
}

/** Equilibrium temperature in K; stellar radius converted to AU so units match. */
export function eqTemp(radiusSun: number, teffK: number, semiMajorAxisAu: number, c: Constants): number {
  const rStarAu = radiusSun * c.solarRadiusAu
  return teffK * Math.sqrt(rStarAu / (2 * semiMajorAxisAu)) * (1 - c.bondAlbedo) ** 0.25
}

/** Kopparapu et al. (2014) Eq. (4), T = Teff - 5780 K. */
export function seff(limit: HzLimit, teffK: number): number {
  const t = teffK - 5780
  return limit.seffSun + limit.a * t + limit.b * t ** 2 + limit.c * t ** 3 + limit.d * t ** 4
}

export type HzClass = 'inside' | 'too hot' | 'too cold'

/** Inside when S lies between the outer and inner effective-flux limits. */
export function hzClass(insolationEarth: number, teffK: number, inner: HzLimit, outer: HzLimit): HzClass {
  if (insolationEarth > seff(inner, teffK)) return 'too hot'
  if (insolationEarth < seff(outer, teffK)) return 'too cold'
  return 'inside'
}

// ---------------------------------------------------------------- Monte Carlo

export interface Uncertain {
  value: number
  errPlus?: number
  errMinus?: number
}

export interface Interval {
  median: number
  p16: number
  p84: number
}

/** mulberry32: small, fast, seedable PRNG returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(next: () => number): number {
  let u = 0
  while (u === 0) u = next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
}

/** Split-normal draw: errPlus scales the upper half, errMinus the lower half. Positive quantities are redrawn. */
export function drawSplitNormal(x: Uncertain, next: () => number): number {
  const up = x.errPlus ?? 0
  const down = x.errMinus ?? up
  for (let i = 0; i < 100; i++) {
    const z = normal(next)
    const v = x.value + z * (z >= 0 ? up : down)
    if (v > 0) return v
  }
  return x.value
}

export function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo)
}

export const DEFAULT_DRAWS = 10_000
export const DEFAULT_SEED = 20261003

/** Propagates uncertainties through fn with seeded split-normal draws. */
export function monteCarlo<K extends string>(
  inputs: Record<K, Uncertain>,
  fn: (v: Record<K, number>) => number,
  draws = DEFAULT_DRAWS,
  seed = DEFAULT_SEED,
): Interval {
  const next = rng(seed)
  const keys = Object.keys(inputs).sort() as K[]
  const out = new Array<number>(draws)
  for (let i = 0; i < draws; i++) {
    const v = {} as Record<K, number>
    for (const k of keys) v[k] = drawSplitNormal(inputs[k], next)
    out[i] = fn(v)
  }
  out.sort((a, b) => a - b)
  return { median: percentile(out, 0.5), p16: percentile(out, 0.16), p84: percentile(out, 0.84) }
}

/** Fraction of draws classed "inside" the habitable zone. */
export function hzProbability(
  inputs: { radiusSun: Uncertain; teffK: Uncertain; semiMajorAxisAu: Uncertain },
  c: Constants,
  inner: HzLimit,
  outer: HzLimit,
  draws = DEFAULT_DRAWS,
  seed = DEFAULT_SEED,
): number {
  const next = rng(seed)
  let inside = 0
  for (let i = 0; i < draws; i++) {
    const a = drawSplitNormal(inputs.semiMajorAxisAu, next)
    const r = drawSplitNormal(inputs.radiusSun, next)
    const t = drawSplitNormal(inputs.teffK, next)
    if (hzClass(insolation(r, t, a, c), t, inner, outer) === 'inside') inside++
  }
  return inside / draws
}
