import type { Final } from './score.ts'
import type { Truth } from './truth.ts'

export interface QuestionResult {
  id: string
  category: string
  question: string
  truth: Truth
  answer: string
  final: Final | null
  correct: boolean
  mixed: boolean | null
  matchingRows: string[]
  citationsValid: boolean
  citedIds: string[]
  toolCalls: { name: string; input: unknown }[]
  computeInputs: unknown[]
  responseModelId?: string
  usage?: { inputTokens: number; outputTokens: number }
  ms: number
  cause?: string
  error?: string
}

export interface Metrics {
  questions: number
  correct: number
  accuracy: number
  /** Derived answers (value or habitable zone, not refused) whose inputs do not trace to one archive row. */
  mixed: number
  derivedAnswered: number
  mixedProvenanceRate: number
  correctRefusals: number
  refusalQuestions: number
  validCitations: number
  validCitationRate: number
}

export interface Results {
  date: string
  model: string
  /** Version string from the provider's models.get at run time, e.g. 3.7-flash-08-2026. */
  modelVersion: string
  responseModelIds: string[]
  embeddingModel: string
  settings: Record<string, unknown>
  inputs: Record<string, string>
  arms: Partial<Record<string, { metrics: Metrics; results: QuestionResult[] }>>
}

export function summarise(rows: QuestionResult[]): Metrics {
  const derived = rows.filter((r) => r.mixed !== null)
  const refusals = rows.filter((r) => r.truth.kind === 'refusal')
  const correct = rows.filter((r) => r.correct).length
  const mixed = derived.filter((r) => r.mixed).length
  const valid = rows.filter((r) => r.citationsValid).length
  return {
    questions: rows.length,
    correct,
    accuracy: rows.length ? correct / rows.length : 0,
    mixed,
    derivedAnswered: derived.length,
    mixedProvenanceRate: derived.length ? mixed / derived.length : 0,
    correctRefusals: refusals.filter((r) => r.correct).length,
    refusalQuestions: refusals.length,
    validCitations: valid,
    validCitationRate: rows.length ? valid / rows.length : 0,
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`
export const ARM_LABEL: Record<string, string> = {
  structured: 'Structured agent (Sanity Context)',
  semantic: 'Semantic search',
  bm25: 'Keyword (BM25)',
  none: 'No content',
}

export function toMarkdown(r: Results): string {
  const lines = [
    `Model: \`${r.model}\`, version \`${r.modelVersion}\` (responses reported: ${r.responseModelIds.join(', ') || 'n/a'}) · ${r.date.slice(0, 10)} · embeddings for semantic arm: \`${r.embeddingModel}\``,
    '',
    '| Arm | Accuracy | Mixed-provenance rate | Correct refusals | Valid citations |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const [arm, a] of Object.entries(r.arms)) {
    const m = a!.metrics
    lines.push(`| ${ARM_LABEL[arm] ?? arm} | ${pct(m.accuracy)} (${m.correct}/${m.questions}) | ${pct(m.mixedProvenanceRate)} (${m.mixed}/${m.derivedAnswered}) | ${m.correctRefusals}/${m.refusalQuestions} | ${pct(m.validCitationRate)} |`)
  }
  lines.push('', '### Failures', '')
  for (const [arm, a] of Object.entries(r.arms)) {
    const failed = a!.results.filter((x) => x.cause)
    lines.push(`**${ARM_LABEL[arm] ?? arm}** — ${failed.length} failures`, '')
    for (const f of failed) lines.push(`- \`${f.id}\` ${f.question} — ${f.cause}`)
    lines.push('')
  }
  return lines.join('\n') + '\n'
}
