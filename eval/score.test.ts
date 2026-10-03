import { describe, expect, it } from 'vitest'
import { isCorrect, parseFinal, score } from './score.ts'
import { loadQuestions, loadReference, provenanceOf, truthFor } from './truth.ts'

describe('FINAL line parsing', () => {
  it('reads each answer form', () => {
    expect(parseFinal('text\nFINAL: 5.29')).toEqual({ type: 'number', value: 5.29 })
    expect(parseFinal('FINAL: 2,741.6')).toEqual({ type: 'number', value: 2741.6 })
    expect(parseFinal('**FINAL:** TOO HOT')).toEqual({ type: 'hz', class: 'too hot' })
    expect(parseFinal('FINAL: PAPER Kane & Gelino 2014')).toEqual({ type: 'paper', text: 'Kane & Gelino 2014' })
    expect(parseFinal('FINAL: REFUSE planet radius')).toEqual({ type: 'refuse', text: 'planet radius' })
    expect(parseFinal('no final line')).toBeNull()
  })
})

describe('correctness', () => {
  it('accepts values within 1% of the true median only', () => {
    const t = { kind: 'value' as const, median: 5.29, unit: 'g/cm3', setCitation: 'x' }
    expect(isCorrect(t, { type: 'number', value: 5.32 })).toBe(true)
    expect(isCorrect(t, { type: 'number', value: 5.4 })).toBe(false)
  })
  it('matches papers by first-author surname and year, ignoring accents', () => {
    const t = { kind: 'paper' as const, citation: 'Suárez Mascareño et al. 2025' }
    expect(isCorrect(t, { type: 'paper', text: 'Suarez Mascareno et al. (2025)' })).toBe(true)
    expect(isCorrect(t, { type: 'paper', text: 'Faria et al. 2022' })).toBe(false)
  })
})

// Offline evaluation subset: ground truth from the raw CSV must be computable for every
// frozen question, and the mixing detector must separate one-row inputs from mixed ones.
describe('offline evaluation subset', () => {
  const ref = loadReference()
  const questions = loadQuestions()
  it('has the frozen 40-question mix', () => {
    const count = (c: string) => questions.filter((q) => q.category === c).length
    expect([questions.length, count('density'), count('insolation-teq'), count('habitable-zone'), count('provenance'), count('refusal')]).toEqual([40, 15, 10, 5, 5, 5])
  })
  it('computes ground truth for every question', () => {
    for (const q of questions) expect(() => truthFor(q, ref)).not.toThrow()
  })
  it('flags Kepler-139 d composite inputs as mixed and its default inputs as single-row', () => {
    expect(provenanceOf('Kepler-139 d', [{ field: 'massEarth', value: 4.65807623 }, { field: 'radiusEarth', value: 1.695 }]).mixed).toBe(false)
    expect(provenanceOf('Kepler-139 d', [{ field: 'massEarth', value: 2 }, { field: 'radiusEarth', value: 1.695 }]).mixed).toBe(true)
  })
  it('scores a composite-built density for a refusal question as wrong and mixed', () => {
    const q = questions.find((x) => x.id === 'r01')!
    const trace = [{ name: 'compute_raw', input: {}, output: { ok: true, inputs: [{ field: 'massEarth', value: 1.055 }, { field: 'radiusEarth', value: 1.02 }] } }]
    const s = score(q, truthFor(q, ref), 'It is 5.49 [planet-proxima-cen-b].\nFINAL: 5.49', trace, new Set(['planet-proxima-cen-b']))
    expect(s.correct).toBe(false)
    expect(s.mixed).toBe(true)
  })
})
