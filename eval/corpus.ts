// The baselines search the same content the structured agent reads: every document in
// the imported NDJSON (rendered as text) plus the archive documentation pages that back
// the Knowledge Base. Built offline, deterministically.
import fs from 'node:fs'
import { readManifest, DOCS_DIR } from '../ingest/lib/archive.ts'

export interface CorpusDoc {
  id: string
  text: string
}

type Doc = { _id: string; _type: string; [k: string]: any }
type M = { value: number; errPlus?: number; errMinus?: number; limitFlag?: number } | undefined

const m = (x: M, unit: string) =>
  x ? `${x.value} ${unit}${x.errPlus !== undefined ? ` (+${x.errPlus}/-${x.errMinus ?? x.errPlus})` : ''}${x.limitFlag ? ' [archive limit flag ' + x.limitFlag + ']' : ''}` : 'not given'

export function buildCorpus(): CorpusDoc[] {
  const docs: Doc[] = fs
    .readFileSync(new URL('../ingest/data/out/production.ndjson', import.meta.url), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
  const byId = new Map(docs.map((d) => [d._id, d]))
  const cite = (ref?: { _ref: string }) => (ref ? byId.get(ref._ref)?.citation ?? ref._ref : 'unknown')
  const name = (ref?: { _ref: string }) => (ref ? byId.get(ref._ref)?.name ?? ref._ref : 'unknown')

  const out: CorpusDoc[] = []
  for (const d of docs) {
    let text: string
    switch (d._type) {
      case 'planet': {
        const c = d.compositeSnapshot ?? {}
        const cv = (k: string, unit: string) => {
          const v = c[k]
          if (!v) return `${k}: not given`
          return `${k}: ${m(v.measurement, unit)} from ${v.calculated ? 'Calculated Value' : v.referenceText}`
        }
        text = `Planet ${d.name}, host star ${name(d.host)}. Archive default parameter set: ${d.defaultParameterSet._ref}. ` +
          `Parameter sets: ${d.parameterSets.map((p: { _ref: string }) => p._ref).join(', ')}. ` +
          `Composite table (pscomppars) values, one row per planet, each value from the reference shown: ` +
          [cv('radiusEarth', 'R_earth'), cv('massEarth', 'M_earth'), cv('semiMajorAxisAu', 'AU'), cv('insolationEarth', 'S_earth'),
            cv('eqTempK', 'K'), cv('stellarRadiusSun', 'R_sun'), cv('stellarMassSun', 'M_sun'), cv('stellarTeffK', 'K')].join('; ') +
          `; composite mass kind ${c.massKind ?? 'not given'}.`
        break
      }
      case 'parameterSet': {
        const st = d.stellarSolution ? byId.get(d.stellarSolution._ref) : undefined
        text = `Parameter set for planet ${name(d.planet)} from ${cite(d.publication)}. Archive default: ${d.defaultFlag ? 'yes' : 'no'}. ` +
          `Radius ${m(d.radiusEarth, 'R_earth')}. Mass ${m(d.massEarth, 'M_earth')}, mass kind ${d.massKind ?? 'not given'}. ` +
          `Semi-major axis ${m(d.semiMajorAxisAu, 'AU')}. Archive insolation ${m(d.archiveInsolationEarth, 'S_earth')}. ` +
          `Archive equilibrium temperature ${m(d.archiveEqTempK, 'K')}. ` +
          (st ? `Stellar solution ${st._id} from ${cite(st.publication)}: radius ${m(st.radiusSun, 'R_sun')}, mass ${m(st.massSun, 'M_sun')}, effective temperature ${m(st.teffK, 'K')}.` : 'No stellar solution given.')
        break
      }
      case 'stellarSolution':
        text = `Stellar solution for star ${name(d.star)} from ${cite(d.publication)}: radius ${m(d.radiusSun, 'R_sun')}, mass ${m(d.massSun, 'M_sun')}, effective temperature ${m(d.teffK, 'K')}.`
        break
      case 'publication':
        text = `Publication ${d.citation}${d.bibcode ? `, bibcode ${d.bibcode}` : ''}${d.adsUrl ? `, ${d.adsUrl}` : ''}.`
        break
      case 'star':
        text = `Star ${d.name}.`
        break
      case 'constant':
      case 'threshold':
        text = `${d._type} ${d.key} = ${d.value} ${d.unit}. Source: ${d.source.citation}, ${d.source.location}.`
        break
      case 'hzLimit':
        text = `Habitable-zone limit ${d.name} (${d.edge} edge), Kopparapu et al. 2014: S_eff_sun ${d.seffSun}, a ${d.a}, b ${d.b}, c ${d.c}, d ${d.d}, valid ${d.teffMinK}-${d.teffMaxK} K.`
        break
      case 'snapshot':
        text = `Snapshot file ${d.file} (${d.table}), ${d.rows} rows, retrieved ${d.retrievedAt}, sha256 ${d.sha256}.`
        break
      default:
        continue
    }
    out.push({ id: d._id, text })
  }

  // Archive documentation, chunked by paragraph runs of about 1,500 characters.
  for (const entry of readManifest(DOCS_DIR)) {
    const txt = fs.readFileSync(new URL(`txt/${entry.file.replace(/\.html$/, '.txt')}`, DOCS_DIR), 'utf8')
    const paras = txt.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
    let buf = ''
    let n = 0
    const flush = () => {
      if (buf) out.push({ id: `doc-${entry.file.replace(/\.html$/, '')}-${++n}`, text: buf })
      buf = ''
    }
    for (const p of paras) {
      if (buf.length + p.length > 1500) flush()
      buf += (buf ? ' ' : '') + p
    }
    flush()
  }
  return out
}

// ------------------------------------------------------------------- BM25

const tokenize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g) ?? []

export class Bm25 {
  private docs: CorpusDoc[]
  private k1 = 1.2
  private b = 0.75
  private tf: Map<string, number>[]
  private df = new Map<string, number>()
  private len: number[]
  private avg: number
  constructor(docs: CorpusDoc[]) {
    this.docs = docs
    this.tf = docs.map((d) => {
      const counts = new Map<string, number>()
      for (const t of tokenize(d.text)) counts.set(t, (counts.get(t) ?? 0) + 1)
      for (const t of counts.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1)
      return counts
    })
    this.len = docs.map((d) => tokenize(d.text).length)
    this.avg = this.len.reduce((a, b) => a + b, 0) / docs.length
  }
  search(query: string, k = 6): CorpusDoc[] {
    const n = this.docs.length
    const terms = [...new Set(tokenize(query))]
    const scored = this.docs.map((doc, i) => {
      let s = 0
      for (const t of terms) {
        const f = this.tf[i]!.get(t)
        if (!f) continue
        const idf = Math.log(1 + (n - this.df.get(t)! + 0.5) / (this.df.get(t)! + 0.5))
        s += idf * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * this.len[i]! / this.avg))
      }
      return { doc, s }
    })
    return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || (a.doc.id < b.doc.id ? -1 : 1)).slice(0, k).map((x) => x.doc)
  }
}
