// The structured agent: Sanity Context (dataset + Knowledge Base) over MCP, plus local
// deterministic compute tools. Tools are discovered with tools/list at runtime.
import { createMCPClient } from '@ai-sdk/mcp'
import { generateText, stepCountIs, tool } from 'ai'
import type { ModelMessage, ToolSet } from 'ai'
import { z } from 'zod'
import { MODEL_ID, contextEndpoints, model } from './config.ts'
import { check } from './guard.ts'
import type { ToolRecord } from './guard.ts'
import { QUANTITIES } from './tools/compute.ts'
import type { ComputeResult, Quantity } from './tools/compute.ts'
import { compositeCounterfactual, computeForSet, fetchReference } from './tools/content.ts'
import { SYSTEM_PROMPT } from './prompt.ts'

export const MAX_STEPS = 12
export const MAX_OUTPUT_TOKENS = 2000
export const PROVIDER_OPTIONS = { google: { thinkingConfig: { thinkingLevel: 'low' as const } } }

export interface TraceEntry extends ToolRecord {
  ms: number
  error?: string
}

export type PrimaryResult = ComputeResult & { setId: string; planet?: string; publication?: string; defaultFlag?: boolean }

export interface AgentRun {
  question: string
  status: 'answered' | 'guard-failed'
  answer: string
  trace: TraceEntry[]
  /** firstViolations: what the guard rejected in the first draft, when it retried. */
  guard: { ok: boolean; violations: string[]; retried: boolean; firstViolations?: string[] }
  primary?: PrimaryResult
  composite?: Awaited<ReturnType<typeof compositeCounterfactual>>
  toolNames: { data: string[]; kb: string[] }
  model: string
  /** Model id reported by the provider in the response. */
  responseModelId: string
  usage: { inputTokens: number; outputTokens: number }
}

export class ContextUnavailableError extends Error {
  endpoint: 'data' | 'kb'
  constructor(endpoint: 'data' | 'kb', cause: unknown) {
    super(ContextUnavailableError.describe(endpoint, String((cause as Error)?.message ?? cause)))
    this.endpoint = endpoint
  }

  // The MCP transport's raw error embeds a JSON-RPC body and a misleading "try sse" hint;
  // turn it into a sentence that names the endpoint and the actual problem.
  static describe(endpoint: 'data' | 'kb', raw: string): string {
    const kind = endpoint === 'data' ? 'dataset' : 'Knowledge Base'
    const missing = /MCP endpoint not found: ([\w-]+)/.exec(raw)?.[1]
    if (missing) return `The Sanity Context ${kind} endpoint "${missing}" does not exist (HTTP 404), so the agent cannot read the data.`
    const status = /\(HTTP (\d{3})\)/.exec(raw)?.[1]
    if (status === '401' || status === '403') return `The Sanity Context ${kind} endpoint rejected the organization token (HTTP ${status}).`
    const message = /"message":"([^"]+)"/.exec(raw)?.[1] ?? raw.split('. ')[0]!.slice(0, 200)
    return `The Sanity Context ${kind} endpoint is unavailable${status ? ` (HTTP ${status})` : ''}: ${message}`
  }
}

async function connect(endpoint: 'data' | 'kb', url: string, trace: TraceEntry[]) {
  try {
    const client = await createMCPClient({
      transport: { type: 'http', url, headers: { Authorization: `Bearer ${process.env.SANITY_ORGANIZATION_TOKEN ?? ''}` } },
    })
    const listed = await client.listTools()
    const discovered = client.toolsFromDefinitions(listed) as ToolSet
    const label = endpoint === 'data' ? 'Sanity Context, dataset (GROQ) mode' : 'Sanity Context, Knowledge Base mode (rules and explanations only)'
    const tools: ToolSet = {}
    for (const [name, t] of Object.entries(discovered)) {
      tools[`${endpoint}_${name}`] = {
        ...t,
        description: `[${label}] ${t.description ?? ''}`,
        execute: async (input: unknown, options: unknown) => {
          const started = Date.now()
          try {
            const output = await (t.execute as (i: unknown, o: unknown) => Promise<unknown>)(input, options)
            trace.push({ name: `${endpoint}_${name}`, input, output, source: endpoint, ms: Date.now() - started })
            return output
          } catch (e) {
            trace.push({ name: `${endpoint}_${name}`, input, output: null, source: endpoint, ms: Date.now() - started, error: (e as Error).message })
            throw e
          }
        },
      } as ToolSet[string]
    }
    return { client, tools, names: listed.tools.map((t) => t.name) }
  } catch (e) {
    throw new ContextUnavailableError(endpoint, e)
  }
}

export async function runAgent(question: string, opts: { signal?: AbortSignal } = {}): Promise<AgentRun> {
  const trace: TraceEntry[] = []
  const urls = contextEndpoints()
  const data = await connect('data', urls.data, trace)
  let kb: Awaited<ReturnType<typeof connect>> | undefined
  try {
    kb = await connect('kb', urls.kb, trace)
    const reference = await fetchReference()

    const record = async <T>(name: string, input: unknown, fn: () => Promise<T>): Promise<T | { error: string }> => {
      const started = Date.now()
      try {
        const output = await fn()
        trace.push({ name, input, output, source: 'compute', ms: Date.now() - started })
        return output
      } catch (e) {
        const output = { error: (e as Error).message }
        trace.push({ name, input, output, source: 'compute', ms: Date.now() - started, error: output.error })
        return output
      }
    }

    const local: ToolSet = {
      compute: tool({
        description:
          'Deterministically compute a derived quantity from ONE archive parameter set (its own planet values and the stellar solution published with it). ' +
          'Returns the median and 16th/84th percentiles from 10,000 Monte Carlo draws, the exact inputs used, and flags; or a refusal naming the missing field.',
        inputSchema: z.object({
          setId: z.string().describe('A parameterSet document _id, e.g. read from the dataset with GROQ'),
          quantity: z.enum(QUANTITIES),
        }),
        execute: ({ setId, quantity }) => record('compute', { setId, quantity }, () => computeForSet(setId, quantity, reference)),
      }),
      composite_counterfactual: tool({
        description:
          "What the archive's composite table (pscomppars) would give: the same quantity computed from composite values that may each come from a different paper. " +
          'Use ONLY when the user explicitly asks about the composite table; never as the answer.',
        inputSchema: z.object({ planet: z.string().describe('Planet slug or name'), quantity: z.enum(QUANTITIES) }),
        execute: ({ planet, quantity }) => record('composite_counterfactual', { planet, quantity }, () => compositeCounterfactual(planet, quantity, reference)),
      }),
    }

    const tools: ToolSet = { ...data.tools, ...kb.tools, ...local }
    const settings = {
      model: model(),
      system: SYSTEM_PROMPT,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: PROVIDER_OPTIONS,
      abortSignal: opts.signal,
    }
    const first = await generateText({ ...settings, prompt: question })
    let answer = first.text.trim()
    let usage = { inputTokens: first.totalUsage.inputTokens ?? 0, outputTokens: first.totalUsage.outputTokens ?? 0 }
    let guard = check(answer, trace, question)
    let retried = false
    let firstViolations: string[] | undefined

    if (!guard.ok) {
      retried = true
      firstViolations = guard.violations
      const messages: ModelMessage[] = [
        { role: 'user', content: question },
        ...first.response.messages,
        {
          role: 'user',
          content:
            'Your answer failed the output guard and was not shown. Violations:\n' +
            guard.violations.map((v) => `- ${v}`).join('\n') +
            '\nRewrite the answer using only numbers, ids and quotes that appear in tool results from this turn. Call tools again if you need to.',
        },
      ]
      const second = await generateText({ ...settings, messages })
      answer = second.text.trim()
      usage = { inputTokens: usage.inputTokens + (second.totalUsage.inputTokens ?? 0), outputTokens: usage.outputTokens + (second.totalUsage.outputTokens ?? 0) }
      guard = check(answer, trace, question)
    }

    const primary = [...trace].reverse().find((t) => t.name === 'compute' && t.output && !(t.output as { error?: string }).error)?.output as PrimaryResult | undefined
    let composite: AgentRun['composite']
    if (primary?.planet) {
      composite = await compositeCounterfactual(primary.planet, primary.quantity as Quantity, reference).catch(() => undefined)
    }

    return {
      question,
      status: guard.ok ? 'answered' : 'guard-failed',
      answer: guard.ok ? answer : 'This answer was withheld: it failed the output guard twice (see the violations in the trace).',
      trace,
      guard: { ...guard, retried, ...(firstViolations && { firstViolations }) },
      primary,
      composite,
      toolNames: { data: data.names, kb: kb.names },
      model: MODEL_ID,
      responseModelId: first.response.modelId,
      usage,
    }
  } finally {
    await data.client.close().catch(() => {})
    await kb?.client.close().catch(() => {})
  }
}
