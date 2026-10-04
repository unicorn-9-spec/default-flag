import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import { sanity } from '@default-flag/agent'

export const revalidate = 3600

const TYPES: [string, string][] = [
  ['planet', 'name, slug, host → star, parameterSets[] → parameterSet, defaultParameterSet → parameterSet, compositeSnapshot {each value + its reference or "Calculated Value"}'],
  ['parameterSet', 'one archive Planetary Systems row: planet, publication, defaultFlag, radiusEarth / massEarth / semiMajorAxisAu {value, errPlus, errMinus, limitFlag}, massKind, stellarSolution, snapshot'],
  ['stellarSolution', 'the stellar values published with that row: star, publication, radiusSun, massSun, teffK'],
  ['publication', 'citation, refname exactly as the archive gives it, bibcode, year, ADS URL'],
  ['snapshot', 'raw file, table, SHA-256, rows, source URL, retrieval time'],
  ['constant / threshold / hzLimit', 'reference values, each with a source citation, URL and location'],
  ['derivedAnswer', 'question, parameterSet, quantity, inputs[] {field, value, set}, result {median, p16, p84}, codeVersion'],
]

const CAPTIONS: Record<string, string> = {
  '1-sources.png': "Knowledge Base source: one GROQ query over the production dataset, 62 documents (each planet's default parameter set and its composite row).",
  '2-entry.png': "Built entry planet_catalogue/mini_neptunes: default sets and composite alternatives in separate tables, with Kepler-139 d's disagreement stated.",
}

function screenshots(): string[] {
  const dir = path.join(process.cwd(), 'public', 'conflict')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort() : []
}

export default async function HowItWorks() {
  const snaps = await sanity().fetch<{ file: string; table: string; sha256: string; rows: number; retrievedAt: string; sourceUrl: string }[]>(
    `*[_type == "snapshot"] | order(file asc){file, table, sha256, rows, retrievedAt, sourceUrl}`,
  )
  const projectId = process.env.SANITY_PROJECT_ID
  const shots = screenshots()
  return (
    <>
      <h1>How it works</h1>
      <h2>The idea</h2>
      <p>
        The NASA Exoplanet Archive publishes one row per planet per paper (the Planetary Systems table) and marks one row as the default. It also
        publishes a composite table with one row per planet whose values are picked parameter by parameter, so a single row can combine a mass from
        one paper with a radius from another, or with a radius the archive calculated from a mass&ndash;radius relation. The archive itself calls that
        table &ldquo;a more complete, though not necessarily self-consistent, set of parameters&rdquo;. Default Flag computes every derived number from
        one self-consistent parameter set and shows the composite answer only as a labelled counterfactual.
      </p>

      <h2>Sanity Context endpoints</h2>
      <ul>
        <li><code>default-flag-data</code>: dataset (GROQ) mode over the <code>production</code> dataset. Structured facts.</li>
        <li><code>defaultflag-kb</code>: Knowledge Base mode (Knowledge Base <code>kbhX0D4yDJok</code>). Archive rules and explanations only; never planet values.</li>
      </ul>
      <p className="muted">
        One endpoint per mode, because an endpoint with both a dataset and a Knowledge Base attached serves the dataset only. Tools are discovered at
        runtime with MCP <code>tools/list</code>; the trace under every answer lists them.
      </p>

      <h2>Knowledge Base conflict, before and after</h2>
        <div>
          <p>
            The Knowledge Base reads one dataset source with two documents per planet: its default parameter set and its composite row.
            For Kepler-139 d they disagree: <strong>4.658 M⊕</strong> (M·sin i, Weiss et al. 2024, the default) against <strong>2 M⊕</strong>{' '}
            (Lammers &amp; Winn 2025, composite).
          </p>
          <p>
            <strong>Context did not raise this as an issue.</strong> The Knowledge Base Purpose states the rule (&ldquo;the self-consistent
            single-source set governs; composite values are recorded only as explicitly labelled alternatives&rdquo;), and the build applied it
            directly. The planet entries keep a &ldquo;Default parameter sets (preferred for derived quantities)&rdquo; table and a separate
            &ldquo;Composite table (mixed-source alternatives)&rdquo; table, and state that Kepler-139 d&rsquo;s composite mass differs from its default.
          </p>
          <p>
            What changed: before the dataset source, the Knowledge Base held only methodology and could not say anything about Kepler-139 d.
            Now, asked which mass to use, the agent answers 4.66 M⊕ from Weiss et al. 2024 and explains that the composite&rsquo;s 2 M⊕ comes from
            another paper. The computed density does not change, by design: numbers come only from the dataset and deterministic code.{' '}
            <Link href="/planet/kepler-139-d">See both rows side by side.</Link>
          </p>
        </div>
      {shots.map((s) => (
        <figure key={s}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/conflict/${s}`} alt={CAPTIONS[s] ?? `Knowledge Base screenshot ${s}`} style={{ maxWidth: '100%', border: '1px solid var(--border)' }} />
          <figcaption className="muted">{CAPTIONS[s] ?? s}</figcaption>
        </figure>
      ))}

      <h2>Schema</h2>
      <dl>
        {TYPES.map(([t, d]) => (
          <div key={t}><dt><code>{t}</code></dt><dd>{d}</dd></div>
        ))}
      </dl>
      {projectId && (
        <p>
          Public GROQ, no token:{' '}
          <a href={`https://${projectId}.api.sanity.io/v2026-10-03/data/query/production?query=${encodeURIComponent('*[_type=="planet"][0...5]{name,"default":defaultParameterSet->publication->citation}')}`}>
            first five planets and their default papers
          </a>{' '}
          (project <code>{projectId}</code>, dataset <code>production</code>).
        </p>
      )}

      <h2>Snapshots</h2>
      <p className="muted">The app reads this snapshot from Sanity; it never queries the archive at answer time.</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)">
        <table>
          <caption className="sr-only">Raw snapshot files</caption>
          <thead><tr><th scope="col">File</th><th scope="col">Rows</th><th scope="col">Retrieved</th><th scope="col">SHA-256</th></tr></thead>
          <tbody>
            {snaps.map((s) => (
              <tr key={s.file}><td>{s.file}</td><td>{s.rows}</td><td>{s.retrievedAt}</td><td><code>{s.sha256}</code></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Code computes, the model explains</h2>
      <ul>
        <li>Density, insolation, equilibrium temperature and habitable-zone status come from deterministic code with 10,000 seeded Monte Carlo draws from split-normal errors.</li>
        <li>An output guard rejects any answer containing a number no tool returned this turn, an id that was not read, or an inexact quote; it retries once, then withholds the answer.</li>
        <li>Habitable-zone limits: Kopparapu et al. 2014 (runaway greenhouse, 1 M⊕, and maximum greenhouse), valid for 2600&ndash;7200 K; answers outside that range say so.</li>
      </ul>
    </>
  )
}
