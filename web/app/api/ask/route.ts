import { ContextUnavailableError, runAgent } from '@default-flag/agent'
import { rateLimited, snapshots } from '@/lib/server'
import type { AskResponse } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_QUESTION_CHARS = 300

function fail(status: number, error: Extract<AskResponse, { ok: false }>['error']) {
  return Response.json({ ok: false, error } satisfies AskResponse, { status })
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (rateLimited(ip)) return fail(429, { component: 'Rate limit', message: 'Too many questions in a minute. Please wait a moment and try again.' })

  let question: unknown
  try {
    question = (await req.json()).question
  } catch {
    return fail(400, { component: 'Request', message: 'Expected a JSON body with a "question" string.' })
  }
  if (typeof question !== 'string' || !question.trim()) return fail(400, { component: 'Request', message: 'Please type a question.' })
  if (question.length > MAX_QUESTION_CHARS) return fail(400, { component: 'Request', message: `Questions are limited to ${MAX_QUESTION_CHARS} characters.` })

  try {
    const [run, snaps] = await Promise.all([runAgent(question.trim(), { signal: req.signal }), snapshots()])
    return Response.json({ ok: true, run, snapshots: snaps } satisfies AskResponse)
  } catch (e) {
    if (e instanceof ContextUnavailableError) return fail(503, { component: 'Sanity Context', message: e.message })
    const message = (e as Error).message ?? String(e)
    if (/sanity|groq|dataset/i.test(message)) return fail(503, { component: 'Sanity dataset', message })
    return fail(502, { component: 'Gemini model', message })
  }
}
