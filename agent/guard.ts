// Output guard (code, not prompt). Checks an answer against the tool results of the
// same turn before it is rendered.

export interface ToolRecord {
  name: string
  input: unknown
  output: unknown
  /** Knowledge Base results explain rules; they are never a source for numbers. */
  source: 'data' | 'kb' | 'compute'
}

export interface GuardResult {
  ok: boolean
  violations: string[]
}

const ID_PATTERN = /\b(?:planet|pset|pub|stsol|star|snapshot|constant|threshold|hzlimit)-[a-z0-9]+(?:-[a-z0-9]+)*\b/g
const KB_CITE_PATTERN = /\bkb:([A-Za-z0-9_./-]+)/g
// Numbers, including decimals, thousands separators and scientific notation (e.g. 1.3e-4).
// Ordinals such as "16th" (percentile labels) are words, not quantities.
const NUMBER_PATTERN = /(?<![\w.])-?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d|\.\d|st\b|nd\b|rd\b|th\b)|(?<![\w.])-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?(?!\d|\.\d|st\b|nd\b|rd\b|th\b)/g

const asText = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v) ?? '')
const normalise = (s: string) => s.replace(/\s+/g, ' ').trim()

export function numbersIn(text: string): number[] {
  return [...text.replace(ID_PATTERN, ' ').matchAll(NUMBER_PATTERN)].map((m) => Number(m[0].replace(/,/g, '')))
}

function decimals(token: number): number {
  const s = String(token)
  if (/e/i.test(s)) return 20
  return s.includes('.') ? s.split('.')[1]!.length : 0
}

/** True when `shown` is `source` rounded to the precision shown, or to the same significant figures. */
export function matchesRounded(shown: number, source: number): boolean {
  if (shown === source) return true
  const d = decimals(shown)
  if (Math.abs(Number(source.toFixed(Math.min(d, 20))) - shown) < 1e-12) return true
  if (shown === 0 || source === 0) return false
  // Trailing zeros of a whole number are rounding, not precision: 1240 is 1244 at 3 s.f.
  const digits = String(Math.abs(shown))
  const sig = (digits.includes('.') ? digits.replace('.', '') : digits.replace(/0+$/, '')).replace(/^0+/, '').length
  return Number(source.toPrecision(Math.max(1, sig))) === shown
}

export function check(answer: string, records: ToolRecord[], question: string): GuardResult {
  const violations: string[] = []
  const allText = records.map((r) => asText(r.output) + ' ' + asText(r.input)).join(' ')
  const numericSources = [
    ...records.filter((r) => r.source !== 'kb').flatMap((r) => numbersIn(asText(r.output))),
    ...numbersIn(question),
  ]

  const percents = new Set([...answer.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((m) => Number(m[1])))
  for (const n of new Set(numbersIn(answer))) {
    const asFraction = percents.has(n) && numericSources.some((s) => matchesRounded(n, s * 100))
    if (!asFraction && !numericSources.some((s) => matchesRounded(n, s))) violations.push(`number ${n} does not appear in any data or compute result from this turn`)
  }
  for (const id of new Set(answer.match(ID_PATTERN) ?? [])) {
    if (!allText.includes(id)) violations.push(`cited id ${id} was not read this turn`)
  }
  const kbText = records.filter((r) => r.source === 'kb').map((r) => asText(r.output) + ' ' + asText(r.input)).join(' ')
  for (const [, raw] of answer.matchAll(KB_CITE_PATTERN)) {
    const path = raw!.replace(/[./-]+$/, '')
    if (!kbText.includes(path)) violations.push(`Knowledge Base entry ${path} was not opened this turn`)
  }
  const sources = normalise(allText.replace(/\\"/g, '"').replace(/\\n/g, ' '))
  for (const [, quote] of answer.matchAll(/["“]([^"”]{12,})["”]/g)) {
    if (!sources.includes(normalise(quote!))) violations.push(`quote "${quote!.slice(0, 60)}" does not match any source exactly`)
  }
  return { ok: violations.length === 0, violations }
}
