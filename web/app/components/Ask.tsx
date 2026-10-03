'use client'
import { useRef, useState } from 'react'
import type { AskResponse, SnapshotInfo } from '@/lib/types'
import type { AgentRun } from '@default-flag/agent'
import { ResultView } from './ResultView'

export const CHIPS = ['Density of Kepler-139 d?', 'Is TRAPPIST-1 e in the habitable zone?', 'Density of Proxima Cen b?']

export interface CachedAnswer {
  run: AgentRun
  snapshots: SnapshotInfo[]
  computedAt: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; question: string; cached?: CachedAnswer }
  | { kind: 'done'; run: AgentRun; snapshots: SnapshotInfo[]; cachedAt?: string; error?: string }
  | { kind: 'error'; question: string; error: string }

export function Ask({ cached }: { cached: Record<string, CachedAnswer> }) {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const controller = useRef<AbortController | null>(null)

  async function ask(q: string) {
    const text = q.trim()
    if (!text) return
    controller.current?.abort()
    const ac = new AbortController()
    controller.current = ac
    setQuestion(text)
    const hit = cached[text]
    setState({ kind: 'loading', question: text, cached: hit })
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: text }),
        signal: ac.signal,
      })
      const body = (await res.json()) as AskResponse
      if (body.ok) setState({ kind: 'done', run: body.run, snapshots: body.snapshots })
      else {
        const error = `${body.error.component}: ${body.error.message}`
        setState(hit ? { kind: 'done', run: hit.run, snapshots: hit.snapshots, cachedAt: hit.computedAt, error } : { kind: 'error', question: text, error })
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const error = `Network: ${(e as Error).message}`
      setState(hit ? { kind: 'done', run: hit.run, snapshots: hit.snapshots, cachedAt: hit.computedAt, error } : { kind: 'error', question: text, error })
    }
  }

  return (
    <section aria-labelledby="ask-heading">
      <h2 id="ask-heading" className="sr-only">Ask a question</h2>
      <div className="chips" role="group" aria-label="Example questions">
        {CHIPS.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => ask(c)}>{c}</button>
        ))}
      </div>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
      >
        <label htmlFor="q" className="sr-only">Your question</label>
        <input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="e.g. Insolation of LHS 1140 b?" autoComplete="off" />
        <button type="submit" disabled={state.kind === 'loading'}>Ask</button>
      </form>

      {state.kind === 'loading' && (
        <>
          <p className="loading" role="status">Working: reading the dataset and Knowledge Base through Sanity Context, then computing…</p>
          {state.cached && <ResultView run={state.cached.run} snapshots={state.cached.snapshots} cachedAt={state.cached.computedAt} />}
        </>
      )}
      {state.kind === 'error' && <div className="banner" role="alert">Could not answer “{state.question}”. {state.error}</div>}
      {state.kind === 'done' && (
        <>
          {state.error && <div className="banner" role="alert">The live run failed, so the cached answer is shown. {state.error}</div>}
          <ResultView run={state.run} snapshots={state.snapshots} cachedAt={state.cachedAt} />
        </>
      )}
    </section>
  )
}
