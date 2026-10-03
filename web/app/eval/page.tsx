import fs from 'node:fs'
import path from 'node:path'

interface Metrics {
  questions: number; correct: number; accuracy: number; mixed: number; derivedAnswered: number
  mixedProvenanceRate: number; correctRefusals: number; refusalQuestions: number; validCitationRate: number
}
interface Row { id: string; category: string; question: string; answer: string; correct: boolean; mixed: boolean | null; citationsValid: boolean; cause?: string; truth: unknown; final: unknown; matchingRows: string[] }
interface Results { date: string; model: string; responseModelIds: string[]; embeddingModel: string; arms: Record<string, { metrics: Metrics; results: Row[] }> }

const LABEL: Record<string, string> = {
  structured: 'Structured agent (Sanity Context)', semantic: 'Semantic search', bm25: 'Keyword (BM25)', none: 'No content',
}
const pct = (x: number) => `${Math.round(x * 100)}%`

function load(): Results | null {
  const file = path.join(process.cwd(), 'data', 'eval-latest.json')
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

export default function EvalPage() {
  const r = load()
  return (
    <>
      <h1>Four-arm evaluation</h1>
      <p>
        40 frozen questions (15 density, 10 insolation or equilibrium temperature, 5 habitable zone, 5 provenance, 5 refusals). Ground truth is
        computed from the archive&rsquo;s default row in the raw snapshot CSV, independent of Sanity and of the model. A number is correct within 1% of
        the true median. Every arm uses the same model, step budget and compute tool; only retrieval differs.
      </p>
      <p className="muted">
        Mixed-provenance rate: share of derived answers whose input values do not all come from one archive row (each value is matched back to the
        snapshot).
      </p>
      {!r ? (
        <div className="banner" role="status">No evaluation results have been committed yet.</div>
      ) : (
        <>
          <p className="muted">
            Model <code>{r.model}</code> (provider reported {r.responseModelIds.join(', ')}) · run {r.date.slice(0, 10)} · semantic arm embeddings{' '}
            <code>{r.embeddingModel}</code>
          </p>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Results by arm</caption>
              <thead>
                <tr><th scope="col">Arm</th><th scope="col">Accuracy</th><th scope="col">Mixed-provenance rate</th><th scope="col">Correct refusals</th><th scope="col">Valid citations</th></tr>
              </thead>
              <tbody>
                {Object.entries(r.arms).map(([arm, a]) => (
                  <tr key={arm}>
                    <th scope="row">{LABEL[arm] ?? arm}</th>
                    <td>{pct(a.metrics.accuracy)} ({a.metrics.correct}/{a.metrics.questions})</td>
                    <td>{pct(a.metrics.mixedProvenanceRate)} ({a.metrics.mixed}/{a.metrics.derivedAnswered})</td>
                    <td>{a.metrics.correctRefusals}/{a.metrics.refusalQuestions}</td>
                    <td>{pct(a.metrics.validCitationRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Per question</h2>
          {r.arms.structured?.results.map((q) => (
            <details key={q.id} className="card">
              <summary>
                <code>{q.id}</code> {q.question}{' '}
                {Object.entries(r.arms).map(([arm, a]) => {
                  const x = a.results.find((y) => y.id === q.id)
                  return <span key={arm} className={`tag ${x?.correct ? 'ok' : 'warn'}`}>{arm}: {x?.correct ? 'correct' : 'wrong'}{x?.mixed ? ', mixed' : ''}</span>
                })}
              </summary>
              <p className="muted">Truth: <code>{JSON.stringify(q.truth)}</code></p>
              {Object.entries(r.arms).map(([arm, a]) => {
                const x = a.results.find((y) => y.id === q.id)
                if (!x) return null
                return (
                  <section key={arm}>
                    <h3>{LABEL[arm] ?? arm}</h3>
                    <p>{x.answer || <em>(no answer)</em>}</p>
                    {x.cause && <p className="flags">{x.cause}</p>}
                    {x.mixed !== null && <p className="muted">Inputs match archive rows: {x.matchingRows.length ? x.matchingRows.join(', ') : 'none (mixed or unsourced)'}</p>}
                  </section>
                )
              })}
            </details>
          ))}
        </>
      )}
    </>
  )
}
