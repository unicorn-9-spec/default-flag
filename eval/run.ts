// Four-arm evaluation runner.
// Usage: node run.ts [--arms structured,semantic,bm25,none] [--ids d01,r01] [--concurrency 3]
import crypto from 'node:crypto'
import fs from 'node:fs'
import { MAX_OUTPUT_TOKENS, MAX_STEPS, PROVIDER_OPTIONS } from '../agent/agent.ts'
import { MODEL_ID } from '../agent/config.ts'
import { loadEnv } from '../agent/env.ts'
import { ARMS, EMBEDDING_MODEL, getCorpus, runArm } from './arms.ts'
import type { Arm, ArmRun } from './arms.ts'
import { score } from './score.ts'
import type { Scored } from './score.ts'
import { loadQuestions, loadReference, truthFor } from './truth.ts'
import type { Question, Truth } from './truth.ts'
import { summarise, toMarkdown } from './report.ts'
import type { QuestionResult, Results } from './report.ts'

loadEnv()
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}
const arms = (arg('arms')?.split(',') ?? [...ARMS]) as Arm[]
const ids = arg('ids')?.split(',')
const concurrency = Number(arg('concurrency') ?? 3)

const ref = loadReference()
const questions = loadQuestions().filter((q) => !ids || ids.includes(q.id))
const knownIds = new Set(getCorpus().map((d) => d.id))
const sha = (file: URL) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function cause(q: Question, t: Truth, s: Scored, error?: string): string | undefined {
  if (error) return `error: ${error.slice(0, 160)}`
  if (s.correct && s.mixed !== true) return undefined
  if (!s.final) return 'no FINAL line'
  if (s.mixed === true && t.kind !== 'refusal') return `inputs do not come from one archive row${s.correct ? ' (value happened to match)' : ''}`
  if (t.kind === 'refusal') return s.final.type === 'refuse' ? `refused, but did not name a missing field (${t.fields.join(' / ')})` : 'answered a question the data cannot support'
  if (s.final.type === 'refuse') return 'refused an answerable question'
  if (t.kind === 'value' && s.final.type === 'number') return `value ${s.final.value} vs truth ${t.median.toPrecision(4)} (${t.setCitation})`
  if (t.kind === 'hz' && s.final.type === 'hz') return `class ${s.final.class} vs truth ${t.class}`
  if (t.kind === 'paper' && s.final.type === 'paper') return `paper "${s.final.text}" vs truth ${t.citation}`
  return `answer type ${s.final.type} does not fit a ${t.kind} question`
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const msg = (e as Error).message
      if (attempt >= 2 || !/429|500|502|503|504|overloaded|timeout|ECONNRESET/i.test(msg)) throw e
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
    }
  }
}

async function one(arm: Arm, q: Question): Promise<QuestionResult> {
  const t = truthFor(q, ref)
  const started = Date.now()
  let run: ArmRun | undefined
  let error: string | undefined
  try {
    run = await withRetry(() => runArm(arm, q.question, ref))
  } catch (e) {
    error = (e as Error).message
  }
  const s = score(q, t, run?.answer ?? '', run?.trace ?? [], knownIds)
  return {
    id: q.id, category: q.category, question: q.question, truth: t,
    answer: run?.answer ?? '', final: s.final, correct: s.correct, mixed: s.mixed, matchingRows: s.matchingRows,
    citationsValid: s.citationsValid, citedIds: s.citedIds,
    toolCalls: (run?.trace ?? []).map((x) => ({ name: x.name, input: x.input })),
    computeInputs: (run?.trace ?? []).filter((x) => x.name === 'compute' || x.name === 'compute_raw').map((x) => (x.output as { inputs?: unknown })?.inputs ?? null),
    responseModelId: run?.responseModelId, usage: run?.usage, ms: Date.now() - started,
    ...(cause(q, t, s, error) && { cause: cause(q, t, s, error) }),
    ...(error && { error }),
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  }))
  return out
}

async function modelVersion(): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}`, {
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
  })
  const body = (await res.json()) as { version?: string }
  if (!res.ok || !body.version) throw new Error(`could not read the version of ${MODEL_ID} (HTTP ${res.status})`)
  return body.version
}

const results: Results = {
  date: new Date().toISOString(),
  model: MODEL_ID,
  modelVersion: await modelVersion(),
  responseModelIds: [],
  embeddingModel: EMBEDDING_MODEL,
  settings: { maxSteps: MAX_STEPS, maxOutputTokens: MAX_OUTPUT_TOKENS, providerOptions: PROVIDER_OPTIONS },
  inputs: {
    questionsSha256: sha(new URL('./questions.json', import.meta.url)),
    datasetNdjsonSha256: sha(new URL('../ingest/data/out/production.ndjson', import.meta.url)),
    psSnapshotSha256: sha(new URL('../ingest/data/raw/nea-tables/nea-ps.csv', import.meta.url)),
  },
  arms: {},
}

for (const arm of arms) {
  console.log(`arm ${arm}: ${questions.length} questions`)
  const rows = await pool(questions, concurrency, async (q) => {
    const r = await one(arm, q)
    console.log(`  ${arm} ${q.id} ${r.correct ? 'ok ' : 'NO '} ${r.mixed === true ? 'MIXED ' : ''}${r.cause ?? ''}`)
    return r
  })
  results.arms[arm] = { metrics: summarise(rows), results: rows }
}
results.responseModelIds = [...new Set(Object.values(results.arms).flatMap((a) => a!.results.map((r) => r.responseModelId).filter(Boolean) as string[]))]

const stamp = results.date.slice(0, 10)
const partial = ids || arms.length !== ARMS.length
const base = `./results/${stamp}${partial ? '-partial' : ''}`
fs.mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL(`${base}.json`, import.meta.url), JSON.stringify(results, null, 2) + '\n')
fs.writeFileSync(new URL(`${base}.md`, import.meta.url), toMarkdown(results))
if (!partial) fs.writeFileSync(new URL('../web/data/eval-latest.json', import.meta.url), JSON.stringify(results, null, 2) + '\n')
console.log('\n' + toMarkdown(results))
