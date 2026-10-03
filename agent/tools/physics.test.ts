import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PS_FILE, groupBy, loadTable, num, text } from '../../ingest/lib/archive.ts'
import { computeFromInputs } from './compute.ts'
import type { Inputs, Reference } from './compute.ts'
import { density, eqTemp, hzClass, insolation, luminosity, monteCarlo, rng, seff } from './physics.ts'
import type { Constants, HzLimit } from './physics.ts'

const reference = JSON.parse(fs.readFileSync(new URL('../../ingest/data/reference.json', import.meta.url), 'utf8'))
const k = Object.fromEntries(reference.constants.map((c: { key: string; value: number }) => [c.key, c.value]))
const C: Constants = { earthDensity: k.earthDensity, solarTeff: k.solarTeff, solarRadiusAu: k.solarRadiusAu, bondAlbedo: k.bondAlbedo }
const inner: HzLimit = reference.hzLimits.find((h: HzLimit) => h.edge === 'inner')
const outer: HzLimit = reference.hzLimits.find((h: HzLimit) => h.edge === 'outer')
const REF: Reference = { constants: C, inner, outer, rockyRadiusEarth: reference.thresholds[0].value, sourceIds: [] }

describe('Earth around the Sun (spec sanity check)', () => {
  it('density is 5.514 g/cm3', () => expect(density(1, 1, C)).toBeCloseTo(5.514, 10))
  it('luminosity and insolation are 1', () => {
    expect(luminosity(1, 5772, C)).toBe(1)
    expect(insolation(1, 5772, 1, C)).toBe(1)
  })
  it('equilibrium temperature is about 255 K at A = 0.3', () => {
    expect(eqTemp(1, 5772, 1, C)).toBeGreaterThan(254)
    expect(eqTemp(1, 5772, 1, C)).toBeLessThan(256)
  })
  it('Earth sits inside the conservative habitable zone', () => expect(hzClass(1, 5772, inner, outer)).toBe('inside'))
})

describe('Kopparapu et al. 2014 Eq. (4)', () => {
  it('reduces to S_eff,sun at Teff = 5780 K', () => {
    expect(seff(inner, 5780)).toBe(1.107)
    expect(seff(outer, 5780)).toBe(0.356)
  })
  it('inner limit flux exceeds outer limit flux across the fitted range', () => {
    for (let t = 2600; t <= 7200; t += 200) expect(seff(inner, t)).toBeGreaterThan(seff(outer, t))
  })
})

describe('Monte Carlo', () => {
  const inputs = { m: { value: 8.92, errPlus: 1.7, errMinus: 1.6 }, r: { value: 2.37, errPlus: 0.22, errMinus: 0.22 } }
  const fn = (v: { m: number; r: number }) => density(v.m, v.r, C)
  it('is identical across runs with the fixed seed', () => expect(monteCarlo(inputs, fn)).toEqual(monteCarlo(inputs, fn)))
  it('changes with a different seed', () => expect(monteCarlo(inputs, fn, 10_000, 1)).not.toEqual(monteCarlo(inputs, fn, 10_000, 2)))
  it('collapses to the nominal value when there is no uncertainty', () => {
    const r = monteCarlo({ m: { value: 2 }, r: { value: 1 } }, fn)
    expect(r.median).toBe(density(2, 1, C))
    expect(r.p16).toBe(r.median)
  })
  it('orders the interval p16 <= median <= p84', () => {
    const r = monteCarlo(inputs, fn)
    expect(r.p16).toBeLessThanOrEqual(r.median)
    expect(r.median).toBeLessThanOrEqual(r.p84)
  })
  it('rng is seedable', () => {
    const a = rng(7), b = rng(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('compute refusals', () => {
  const p = { kind: 'user' as const }
  it('names the missing field', () => {
    const r = computeFromInputs('density', { massEarth: { value: 1.055, provenance: p } }, REF, 'Proxima Cen b')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.field).toBe('radiusEarth')
      expect(r.message).toContain('Proxima Cen b has no planet radius')
    }
  })
  it('refuses a value the archive flags as a limit', () => {
    const inputs: Inputs = { massEarth: { value: 2741.6, limitFlag: 1, provenance: p }, radiusEarth: { value: 1, provenance: p } }
    const r = computeFromInputs('density', inputs, REF, 'X')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('limit')
  })
  it('flags a density built on a minimum mass', () => {
    const inputs: Inputs = { massKind: 'Msini', massEarth: { value: 4, provenance: p }, radiusEarth: { value: 1.5, provenance: p } }
    const r = computeFromInputs('density', inputs, REF, 'X')
    expect(r.ok && r.flags.some((f) => f.startsWith('minimum-mass'))).toBe(true)
  })
  it('flags habitable-zone limits extrapolated below 2600 K', () => {
    const inputs: Inputs = {
      stellarRadiusSun: { value: 0.1192, provenance: p }, stellarTeffK: { value: 2566, provenance: p }, semiMajorAxisAu: { value: 0.02925, provenance: p },
    }
    const r = computeFromInputs('hzStatus', inputs, REF, 'TRAPPIST-1 e')
    expect(r.ok && r.flags.some((f) => f.startsWith('teff-outside-hz-fit'))).toBe(true)
  })
})

// Agreement with the archive's own derived columns, computed straight from the raw
// snapshot rows (independent of Sanity). The archive's Teq conventions vary by paper
// (albedo, redistribution), so Teq is compared at A = 0 with a looser tolerance.
describe('agreement with archive insolation and equilibrium temperature', () => {
  const rows = loadTable(PS_FILE).filter((r) => num(r, 'default_flag') === 1)
  const complete = rows.filter((r) => ['st_rad', 'st_teff', 'pl_orbsmax'].every((c) => num(r, c) !== null))
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

  it('insolation: median relative difference under 5%', () => {
    const diffs = complete.filter((r) => num(r, 'pl_insol') !== null && num(r, 'pl_insollim') === 0).map((r) =>
      Math.abs(insolation(num(r, 'st_rad')!, num(r, 'st_teff')!, num(r, 'pl_orbsmax')!, C) / num(r, 'pl_insol')! - 1))
    expect(diffs.length).toBeGreaterThan(500)
    expect(median(diffs)).toBeLessThan(0.05)
  })
  it('equilibrium temperature (A = 0): median relative difference under 5%', () => {
    const c0 = { ...C, bondAlbedo: 0 }
    const diffs = complete.filter((r) => num(r, 'pl_eqt') !== null && num(r, 'pl_eqtlim') === 0).map((r) =>
      Math.abs(eqTemp(num(r, 'st_rad')!, num(r, 'st_teff')!, num(r, 'pl_orbsmax')!, c0) / num(r, 'pl_eqt')! - 1))
    expect(diffs.length).toBeGreaterThan(500)
    expect(median(diffs)).toBeLessThan(0.05)
  })
  it('the snapshot has exactly one default row per planet', () => {
    const all = groupBy(loadTable(PS_FILE), (r) => text(r, 'pl_name')!)
    const bad = [...all].filter(([, rs]) => rs.filter((r) => num(r, 'default_flag') === 1).length !== 1)
    expect(bad.map(([n]) => n)).toEqual([])
  })
})
