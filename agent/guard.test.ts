import { describe, expect, it } from 'vitest'
import { check, matchesRounded, numbersIn } from './guard.ts'
import type { ToolRecord } from './guard.ts'

const compute: ToolRecord = {
  name: 'compute',
  source: 'compute',
  input: { setId: 'pset-kepler-139-d-weiss-et-al-2024', quantity: 'density' },
  output: { setId: 'pset-kepler-139-d-weiss-et-al-2024', result: { median: 5.2691, p16: 4.31, p84: 6.4 }, publication: 'Weiss et al. 2024' },
}
const kb: ToolRecord = {
  name: 'kb_knowledge_base_read',
  source: 'kb',
  input: { paths: ['composite_parameters/overview'] },
  output: 'The composite table is a more complete, though not necessarily self-consistent, set of parameters. Example: 42.0',
}

describe('numbers', () => {
  it('extracts decimals, separators and exponents', () => expect(numbersIn('5.27, 2,741.6 and 1.3e-4')).toEqual([5.27, 2741.6, 1.3e-4]))
  it('ignores digits inside document ids', () => expect(numbersIn('see pset-k2-18-b-x')).toEqual([]))
  it('accepts rounding to the shown precision', () => {
    expect(matchesRounded(5.27, 5.2691)).toBe(true)
    expect(matchesRounded(5.3, 5.2691)).toBe(true)
    expect(matchesRounded(5.28, 5.2691)).toBe(false)
  })
})

describe('guard', () => {
  it('passes an answer whose numbers and ids come from this turn', () => {
    const r = check('Kepler-139 d has a density of 5.27 g/cm3 (4.31 to 6.4) [pset-kepler-139-d-weiss-et-al-2024].', [compute], 'Density of Kepler-139 d?')
    expect(r).toEqual({ ok: true, violations: [] })
  })
  it('rejects a number no tool returned', () => {
    const r = check('The density is 7.1 g/cm3.', [compute], 'q')
    expect(r.ok).toBe(false)
    expect(r.violations[0]).toContain('7.1')
  })
  it('does not accept planet values sourced only from the Knowledge Base', () => {
    expect(check('It is 42.0.', [kb], 'q').ok).toBe(false)
  })
  it('rejects an id that was not read', () => {
    expect(check('Per [pset-k2-18-b-benneke-et-al-2019].', [compute], 'q').ok).toBe(false)
  })
  it('accepts an exact quote and rejects an altered one', () => {
    expect(check('The archive says "a more complete, though not necessarily self-consistent, set of parameters".', [kb], 'q').ok).toBe(true)
    expect(check('The archive says "a complete and fully self-consistent set of parameters".', [kb], 'q').ok).toBe(false)
  })
  it('requires a cited Knowledge Base path to have been opened', () => {
    expect(check('See kb:composite_parameters/overview.', [kb], 'q').ok).toBe(true)
    expect(check('See kb:derived_quantities/density.', [kb], 'q').ok).toBe(false)
  })
})
