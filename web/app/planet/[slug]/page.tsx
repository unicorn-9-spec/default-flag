import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QUANTITIES, compositeInputs, computeFromInputs, fetchPlanet, fetchReference, quantityLabel, setInputs } from '@default-flag/agent'
import type { ComputeResult } from '@default-flag/agent'

export const revalidate = 3600

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2))

function Cell({ r }: { r: ComputeResult }) {
  if (!r.ok) return <span className="muted" title={r.message}>— no {r.fieldLabel}{r.reason === 'limit' ? ' (limit)' : ''}</span>
  return (
    <>
      {fmt(r.result.median)} <span className="muted">[{fmt(r.result.p16)}–{fmt(r.result.p84)}]</span>
      {r.hz && <div>{r.hz.class}</div>}
      {r.flags.some((f) => f.startsWith('minimum-mass')) && <div className="tag warn">lower limit</div>}
    </>
  )
}

const measure = (m?: { value: number; limitFlag?: number }) => (m ? `${m.value}${m.limitFlag ? ' (limit)' : ''}` : '—')

export default async function PlanetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [planet, reference] = await Promise.all([fetchPlanet(slug), fetchReference()])
  if (!planet) notFound()
  const sets = [...planet.sets].sort((a, b) => Number(b.defaultFlag) - Number(a.defaultFlag) || a.publication.citation.localeCompare(b.publication.citation))
  const composite = QUANTITIES.map((q) => computeFromInputs(q, compositeInputs(planet), reference, `${planet.name} (composite row)`))

  return (
    <>
      <h1>{planet.name}</h1>
      <p className="muted">
        Host {planet.host} · {sets.length} published parameter sets in the archive snapshot. The archive default is highlighted. Each row is computed
        from that paper&rsquo;s own values only.
      </p>
      {planet.selection && (
        <p className="muted">Why this planet is in the demo: {planet.selection.reasons.join('; ')}.</p>
      )}
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)">
        <table>
          <caption className="sr-only">Parameter sets for {planet.name}</caption>
          <thead>
            <tr>
              <th scope="col">Paper</th>
              <th scope="col">R [R⊕]</th>
              <th scope="col">M [M⊕]</th>
              <th scope="col">a [AU]</th>
              {QUANTITIES.map((q) => <th scope="col" key={q}>{quantityLabel(q)}</th>)}
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s._id} className={s.defaultFlag ? 'default' : undefined}>
                <th scope="row">
                  {s.publication.adsUrl ? <a href={s.publication.adsUrl}>{s.publication.citation}</a> : s.publication.citation}
                  {s.defaultFlag && <span className="tag">default</span>}
                  <div><code>{s._id}</code></div>
                </th>
                <td>{measure(s.radiusEarth)}</td>
                <td>{measure(s.massEarth)}{s.massKind && <div className="muted">{s.massKind}</div>}</td>
                <td>{measure(s.semiMajorAxisAu)}</td>
                {QUANTITIES.map((q) => <td key={q}><Cell r={computeFromInputs(q, setInputs(s), reference, planet.name)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="composite">
        <h2>What the composite table would give</h2>
        <p className="muted">
          The archive&rsquo;s Planetary Systems Composite Parameters table keeps one row per planet and fills each value from whichever reference its
          rules pick, so a single row can mix papers.
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)">
          <table>
            <caption className="sr-only">Composite values and their references</caption>
            <thead><tr><th scope="col">Value</th><th scope="col">Composite</th><th scope="col">Reference</th></tr></thead>
            <tbody>
              {(['radiusEarth', 'massEarth', 'semiMajorAxisAu', 'stellarRadiusSun', 'stellarTeffK'] as const).map((f) => {
                const c = planet.composite[f]
                return (
                  <tr key={f}>
                    <th scope="row">{f}</th>
                    <td>{measure(c?.measurement)}{f === 'massEarth' && planet.composite.massKind && <div className="muted">{planet.composite.massKind}</div>}</td>
                    <td>{c?.calculated ? <span className="tag warn">Calculated Value</span> : c?.publication?.citation ?? c?.referenceText ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <ul>
          {composite.map((r) => (
            <li key={r.quantity}>
              {quantityLabel(r.quantity)}: <Cell r={r} />
              {r.ok && r.distinctSources.length > 1 && <span className="muted"> — mixes {r.distinctSources.join(' + ')}</span>}
            </li>
          ))}
        </ul>
      </section>
      <p><Link href="/planet">All planets</Link></p>
    </>
  )
}
