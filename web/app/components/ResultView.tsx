'use client'
import Link from 'next/link'
import { useId, useState } from 'react'
import type { AgentRun, ComputeResult } from '@default-flag/agent'
import type { SnapshotInfo } from '@/lib/types'

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2))

export function ValueLine({ r }: { r: ComputeResult }) {
  if (!r.ok) return <p className="refusal">{r.message}</p>
  return (
    <p className="value">
      <strong>{fmt(r.result.median)}</strong> {r.unit}{' '}
      <span className="muted">
        (16th–84th percentile {fmt(r.result.p16)}–{fmt(r.result.p84)})
      </span>
      {r.hz && (
        <>
          {' '}· habitable zone: <strong>{r.hz.class}</strong>{' '}
          <span className="muted">({Math.round(r.hz.probabilityInside * 100)}% of draws inside)</span>
        </>
      )}
    </p>
  )
}

function Flags({ r }: { r: ComputeResult }) {
  if (!r.ok || r.flags.length === 0) return null
  return (
    <ul className="flags" aria-label="Caveats">
      {r.flags.map((f) => (
        <li key={f}>{f.includes(': ') ? f.split(': ').slice(1).join(': ') : f.replace(/^no-uncertainty:/, 'No uncertainty published for ')}</li>
      ))}
    </ul>
  )
}

export function ProvenanceStrip({ run, snapshots }: { run: AgentRun; snapshots: SnapshotInfo[] }) {
  const p = run.primary
  if (!p) return null
  const stellar = p.ok ? p.inputs.find((i) => i.provenance.kind === 'stellarSolution') : undefined
  const ps = snapshots.find((s) => s.table === 'ps')
  return (
    <dl className="provenance" aria-label="Provenance">
      <div><dt>Planet</dt><dd>{p.planet}</dd></div>
      <div><dt>Parameter set</dt><dd><code>{p.setId}</code></dd></div>
      <div><dt>Paper</dt><dd>{p.publication}{p.defaultFlag ? <span className="tag">archive default</span> : <span className="tag alt">non-default</span>}</dd></div>
      {p.ok && p.massKind && <div><dt>Mass kind</dt><dd>{p.massKind === 'Msini' ? 'M·sin i (minimum mass)' : p.massKind}</dd></div>}
      {stellar && stellar.provenance.citation !== p.publication && (
        <div><dt>Stellar values</dt><dd>{stellar.provenance.citation} <span className="muted">(published with this row)</span></dd></div>
      )}
      {ps && <div><dt>Snapshot</dt><dd>{ps.file.split('/').pop()} · {ps.retrievedAt.slice(0, 10)} · sha256 <code>{ps.sha256.slice(0, 12)}…</code></dd></div>}
    </dl>
  )
}

export function CompositePanel({ run }: { run: AgentRun }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const c = run.composite
  if (!c) return null
  return (
    <section className="composite">
      <label className="switch">
        <input type="checkbox" role="switch" checked={open} onChange={(e) => setOpen(e.target.checked)} aria-controls={id} />
        <span>What the composite table would give</span>
      </label>
      <div id={id} hidden={!open}>
        <ValueLine r={c} />
        {c.ok && (
          <>
            <p className="muted">
              Built from {c.distinctSources.length} source{c.distinctSources.length === 1 ? '' : 's'}: {c.distinctSources.join(', ')}.
              {c.distinctSources.length > 1 && ' These values were never published together.'}
            </p>
            <table>
              <caption className="sr-only">Composite inputs and their references</caption>
              <thead><tr><th scope="col">Input</th><th scope="col">Value</th><th scope="col">Reference</th></tr></thead>
              <tbody>
                {c.inputs.map((i) => (
                  <tr key={i.field}>
                    <td>{i.label}</td>
                    <td>{i.value} {i.unit}</td>
                    <td>{i.provenance.calculated ? <span className="tag warn">Calculated Value</span> : i.provenance.citation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <Flags r={c} />
      </div>
    </section>
  )
}

export function TracePanel({ run }: { run: AgentRun }) {
  return (
    <details className="trace">
      <summary>Trace: {run.trace.length} tool calls · {run.model} · guard {run.guard.ok ? 'passed' : 'failed'}{run.guard.retried ? ' after one retry' : ''}</summary>
      <p className="muted">
        Tools discovered via tools/list — dataset: {run.toolNames.data.join(', ')}; Knowledge Base: {run.toolNames.kb.join(', ')}.
      </p>
      {run.guard.violations.length > 0 && (
        <ul className="flags">{run.guard.violations.map((v) => <li key={v}>{v}</li>)}</ul>
      )}
      <ol>
        {run.trace.map((t, i) => (
          <li key={i}>
            <p><code>{t.name}</code> <span className="muted">{t.source} · {t.ms} ms{t.error ? ` · error: ${t.error}` : ''}</span></p>
            <pre tabIndex={0}>{JSON.stringify(t.input, null, 1)}</pre>
            <details>
              <summary>Output</summary>
              <pre tabIndex={0}>{truncate(JSON.stringify(t.output, null, 1))}</pre>
            </details>
          </li>
        ))}
      </ol>
    </details>
  )
}

const truncate = (s: string | undefined, n = 4000) => (s && s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} more characters)` : s ?? '')

export function ResultView({ run, snapshots, cachedAt }: { run: AgentRun; snapshots: SnapshotInfo[]; cachedAt?: string }) {
  const planetSlug = run.primary?.planet?.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return (
    <article className="card" aria-live="polite">
      <header>
        <h2>{run.question}</h2>
        <span className={`tag ${cachedAt ? 'alt' : 'ok'}`}>{cachedAt ? `cached · computed ${cachedAt.slice(0, 10)}` : 'live'}</span>
      </header>
      <p className="answer">{run.answer}</p>
      {run.primary && <ValueLine r={run.primary} />}
      {run.primary && <Flags r={run.primary} />}
      <ProvenanceStrip run={run} snapshots={snapshots} />
      <CompositePanel run={run} />
      {planetSlug && <p><Link href={`/planet/${planetSlug}`}>Every parameter set for {run.primary?.planet} →</Link></p>}
      <TracePanel run={run} />
    </article>
  )
}
