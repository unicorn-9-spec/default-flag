// The four evaluation arms. Same model, step budget, token cap, answer rules and compute
// arithmetic for all of them; only retrieval differs.
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { cosineSimilarity, embed, embedMany, generateText, stepCountIs, tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'
import { MAX_OUTPUT_TOKENS, MAX_STEPS, PROVIDER_OPTIONS, runAgent } from '../agent/agent.ts'
import { model } from '../agent/config.ts'
import { EVAL_SUFFIX, NO_CONTENT_PROMPT, SEARCH_BASELINE_PROMPT } from '../agent/prompt.ts'
import { QUANTITIES, computeFromInputs } from '../agent/tools/compute.ts'
import type { Field, Inputs, Reference } from '../agent/tools/compute.ts'
import { Bm25, buildCorpus } from './corpus.ts'
import type { CorpusDoc } from './corpus.ts'

export const ARMS = ['structured', 'semantic', 'bm25', 'none'] as const
export type Arm = (typeof ARMS)[number]
export const EMBEDDING_MODEL = 'gemini-embedding-2'
const TOP_K = 6

export interface ArmRun {
  answer: string
  trace: { name: string; input: unknown; output: unknown }[]
  responseModelId: string
  usage: { inputTokens: number; outputTokens: number }
}

const measure = z.object({ value: z.number(), errPlus: z.number().optional(), errMinus: z.number().optional() })

function computeRawTool(ref: Reference, trace: ArmRun['trace']) {
  return tool({
    description:
      'Compute a derived quantity from input values you provide. density needs massEarth and radiusEarth; insolation, eqTemp and hzStatus need stellarRadiusSun, stellarTeffK and semiMajorAxisAu. ' +
      'Include errPlus/errMinus when known and massKind (e.g. "Mass" or "Msini") when known. Returns the median and 16th/84th percentiles, flags, or a refusal naming a missing input.',
    inputSchema: z.object({
      quantity: z.enum(QUANTITIES),
      planet: z.string(),
      massEarth: measure.optional(),
      radiusEarth: measure.optional(),
      semiMajorAxisAu: measure.optional(),
      stellarRadiusSun: measure.optional(),
      stellarTeffK: measure.optional(),
      massKind: z.string().optional(),
    }),
    execute: async (args) => {
      const inputs: Inputs = { massKind: args.massKind }
      for (const f of ['massEarth', 'radiusEarth', 'semiMajorAxisAu', 'stellarRadiusSun', 'stellarTeffK'] as Field[]) {
        const v = args[f]
        if (v) inputs[f] = { ...v, provenance: { kind: 'user' } }
      }
      const output = computeFromInputs(args.quantity, inputs, ref, args.planet)
      trace.push({ name: 'compute_raw', input: args, output })
      return output
    },
  })
}

// --------------------------------------------------------- retrieval indexes

let corpus: CorpusDoc[] | undefined
let bm25: Bm25 | undefined
let vectors: number[][] | undefined

export function getCorpus(): CorpusDoc[] {
  corpus ??= buildCorpus()
  return corpus
}

const google = () => createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })

async function semanticIndex(): Promise<number[][]> {
  if (vectors) return vectors
  const docs = getCorpus()
  const key = crypto.createHash('sha256').update(EMBEDDING_MODEL + JSON.stringify(docs)).digest('hex').slice(0, 16)
  const cacheFile = new URL(`./cache/embeddings-${key}.json`, import.meta.url)
  if (fs.existsSync(cacheFile)) {
    vectors = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    return vectors!
  }
  const { embeddings } = await embedMany({
    model: google().embedding(EMBEDDING_MODEL),
    values: docs.map((d) => d.text),
    providerOptions: { google: { taskType: 'RETRIEVAL_DOCUMENT' } },
  })
  fs.mkdirSync(new URL('./cache/', import.meta.url), { recursive: true })
  fs.writeFileSync(cacheFile, JSON.stringify(embeddings))
  vectors = embeddings
  return embeddings
}

async function semanticSearch(query: string): Promise<CorpusDoc[]> {
  const index = await semanticIndex()
  const { embedding } = await embed({
    model: google().embedding(EMBEDDING_MODEL),
    value: query,
    providerOptions: { google: { taskType: 'RETRIEVAL_QUERY' } },
  })
  const docs = getCorpus()
  return index
    .map((v, i) => ({ i, s: cosineSimilarity(embedding, v) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, TOP_K)
    .map(({ i }) => docs[i]!)
}

function keywordSearch(query: string): CorpusDoc[] {
  bm25 ??= new Bm25(getCorpus())
  return bm25.search(query, TOP_K)
}

// --------------------------------------------------------------------- arms

const settings = { stopWhen: stepCountIs(MAX_STEPS), maxOutputTokens: MAX_OUTPUT_TOKENS, providerOptions: PROVIDER_OPTIONS }

export async function runArm(arm: Arm, question: string, ref: Reference): Promise<ArmRun> {
  const prompt = question + EVAL_SUFFIX
  if (arm === 'structured') {
    const run = await runAgent(prompt)
    return {
      answer: run.answer,
      trace: run.trace.map(({ name, input, output }) => ({ name, input, output })),
      responseModelId: run.responseModelId,
      usage: run.usage,
    }
  }
  const trace: ArmRun['trace'] = []
  const tools: ToolSet = { compute_raw: computeRawTool(ref, trace) }
  if (arm !== 'none') {
    const search = arm === 'semantic' ? semanticSearch : async (q: string) => keywordSearch(q)
    tools.search_documents = tool({
      description: `Search the document collection (${arm === 'semantic' ? 'semantic embedding search' : 'keyword BM25 search'}). Returns up to ${TOP_K} documents with their ids.`,
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const output = (await search(query)).map((d) => ({ id: d.id, text: d.text }))
        trace.push({ name: 'search_documents', input: { query }, output })
        return output
      },
    })
  }
  const r = await generateText({
    model: model(),
    system: arm === 'none' ? NO_CONTENT_PROMPT : SEARCH_BASELINE_PROMPT,
    prompt,
    tools,
    ...settings,
  })
  return {
    answer: r.text.trim(),
    trace,
    responseModelId: r.response.modelId,
    usage: { inputTokens: r.totalUsage.inputTokens ?? 0, outputTokens: r.totalUsage.outputTokens ?? 0 },
  }
}
