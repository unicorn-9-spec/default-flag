// Scoring: pure functions over an arm's answer, trace and the ground truth.
import type { Question, Truth } from './truth.ts'
import { provenanceOf } from './truth.ts'

export type Final =
  | { type: 'number'; value: number }
  | { type: 'hz'; class: 'inside' | 'too hot' | 'too cold' }
  | { type: 'paper'; text: string }
  | { type: 'refuse'; text: string }

export function parseFinal(answer: string): Final | null {
  const line = [...answer.matchAll(/^\s*\**FINAL:\**\s*(.+?)\s*$/gim)].pop()?.[1]
  if (!line) return null
  const s = line.replace(/[`*]/g, '').trim()
  if (/^REFUSE\b/i.test(s)) return { type: 'refuse', text: s.replace(/^REFUSE\s*/i, '') }
  if (/^PAPER\b/i.test(s)) return { type: 'paper', text: s.replace(/^PAPER\s*/i, '') }
  if (/^INSIDE\b/i.test(s)) return { type: 'hz', class: 'inside' }
  if (/^TOO\s+HOT\b/i.test(s)) return { type: 'hz', class: 'too hot' }
  if (/^TOO\s+COLD\b/i.test(s)) return { type: 'hz', class: 'too cold' }
  const n = /-?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?/i.exec(s)
  return n ? { type: 'number', value: Number(n[0].replace(/,/g, '')) } : null
}

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

export function isCorrect(truth: Truth, final: Final | null): boolean {
  if (!final) return false
  switch (truth.kind) {
    case 'value':
      return final.type === 'number' && Math.abs(final.value - truth.median) <= 0.01 * Math.abs(truth.median)
    case 'hz':
      return final.type === 'hz' && final.class === truth.class
    case 'paper': {
      if (final.type !== 'paper') return false
      const surname = fold(truth.citation.split(/\s|,/)[0]!)
      const year = /\d{4}/.exec(truth.citation)?.[0]
      return fold(final.text).includes(surname) && (!year || final.text.includes(year))
    }
    case 'refusal':
      return final.type === 'refuse' && truth.fields.some((f) => fold(final.text).includes(fold(f.split(' ').pop()!)))
  }
}

export interface TraceLike {
  name: string
  input: unknown
  output: unknown
}

/** The inputs behind the answer: the last successful compute call of either kind. */
export function computeInputs(trace: TraceLike[]): { field: any; value: number }[] | null {
  const call = [...trace].reverse().find((t) => (t.name === 'compute' || t.name === 'compute_raw') && (t.output as { ok?: boolean })?.ok === true)
  return call ? ((call.output as { inputs: { field: string; value: number }[] }).inputs) : null
}

export interface Scored {
  correct: boolean
  final: Final | null
  /** null when the question is not a derived value, or the arm refused. */
  mixed: boolean | null
  matchingRows: string[]
  citationsValid: boolean
  citedIds: string[]
}

const CITE_PATTERN = /\b(?:planet|pset|pub|stsol|star|snapshot|constant|threshold|hzlimit|doc)-[a-z0-9]+(?:-[a-z0-9]+)*\b/g

export function score(q: Question, truth: Truth, answer: string, trace: TraceLike[], knownIds: Set<string>): Scored {
  const final = parseFinal(answer)
  const correct = isCorrect(truth, final)

  let mixed: boolean | null = null
  let matchingRows: string[] = []
  // Any derived answer counts, including one given to a question the data cannot support
  // (e.g. a density built from a composite "Calculated Value" radius).
  const derived = q.quantity !== undefined
  if (derived && final && final.type !== 'refuse') {
    const inputs = computeInputs(trace)
    if (!inputs) mixed = true // a derived answer with no traceable inputs
    else ({ mixed, matchingRows } = provenanceOf(q.planet, inputs))
  }

  const body = answer.replace(/^\s*\**FINAL:.*$/gim, '')
  const cited = [...new Set(body.match(CITE_PATTERN) ?? [])]
  const seen = trace.map((t) => JSON.stringify(t.output) + JSON.stringify(t.input)).join(' ')
  const citationsValid = cited.length > 0 && cited.every((id) => knownIds.has(id) && seen.includes(id))
  return { correct, final, mixed, matchingRows, citationsValid, citedIds: cited }
}
